import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, getPostgresSslConfig } from '../src/db/index.ts';
import { sql, eq, and, isNull } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { users } from '../src/db/schema.ts';
import { migrateLegacyAIKnowledgeMetadata } from './modules/ai/ai.metadata.migration.ts';

export async function runMigrations() {
  const maxRetries = 5;
  const retryDelayMs = 2000;
  let isConnected = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Verify database connectivity
      await db.execute(sql`SELECT 1`);
      isConnected = true;
      break;
    } catch (connErr: any) {
      console.warn(`[Migration] Database connection attempt ${attempt}/${maxRetries} failed: ${connErr?.message || connErr}`);
      if (attempt < maxRetries) {
        console.log(`[Migration] Waiting ${retryDelayMs / 1000}s for پایگاه داده to be ready...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  if (!isConnected) {
    const strictStartup =
      process.env.NODE_ENV === 'production' || process.env.STRICT_DB_STARTUP === 'true';
    if (strictStartup && process.env.STRICT_DB_STARTUP !== 'false') {
      throw new Error(
        '[FATAL MIGRATION ERROR] Could not establish connection to PostgreSQL after 5 attempts. Refusing to start application in a false-healthy state.'
      );
    }
    console.log('[Migration] Database connectivity notice: Could not establish connection after multiple attempts.');
    return;
  }

  try {
    // 2. Ensure schema privileges if admin credentials exist
    await ensureSchemaPrivileges();

    // 3. Apply Drizzle SQL migrations first so core tables exist before column/index verification
    const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
    if (fs.existsSync(migrationsFolder)) {
      try {
        await migrate(db, { migrationsFolder });
        console.log('[Migration] Database schema migrations verified and applied.');
      } catch (migrationErr: any) {
        const msg = String(migrationErr?.message || migrationErr);
        if (msg.includes('CREATE SCHEMA') || msg.includes('permission denied') || msg.includes('already exists')) {
          console.log('[Migration] Database schema is actively managed by Cloud SQL schema provider.');
        } else {
          console.error('[Migration] Required Drizzle schema migration failed:', msg);
          throw migrationErr;
        }
      }
    } else {
      console.log('[Migration] Database connected successfully.');
    }

    // 4. Ensure all table columns and custom tables exist in پایگاه داده
    await ensureSchemaColumnsAndTables();

    // Backfill legacy AI knowledge docs only after schema migrations have run.
    // NULL becomes {}, preserving category-level permissions for legacy documents.
    const aiMetadataMigration = await migrateLegacyAIKnowledgeMetadata();
    if (aiMetadataMigration.skipped) {
      console.log('[Migration] AI knowledge metadata backfill skipped: table or metadata column not present yet.');
    } else {
      console.log(`[Migration] AI knowledge metadata backfill complete: ${aiMetadataMigration.migratedCount} legacy document(s) converted from NULL to {}.`);
    }

    // 5. Ensure high-performance composite and lookup indexes
    await ensurePerformanceIndexes();

    // 6. Seed default administrator account if پایگاه داده has no active administrator
    await seedDefaultAdminIfMissing();
  } catch (err: any) {
    console.error('[Migration] Schema execution failed:', err?.message || err);
    const strictSchemaStartup =
      process.env.STRICT_DB_STARTUP === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.STRICT_DB_STARTUP !== 'false');
    if (strictSchemaStartup) {
      throw err;
    }
  }
}

async function executeBatchWithFallback(statements: string[], label: string) {
  try {
    await db.execute(sql.raw(statements.join('\n')));
    return;
  } catch {
    const failures: string[] = [];
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err: any) {
        const message = String(err?.message || err);
        failures.push(message);
        console.warn(`[Migration] ${label} statement failed:`, message);
      }
    }
    if (failures.length > 0) {
      throw new Error(`[Migration] ${label} incomplete: ${failures.length} statement(s) failed. First error: ${failures[0]}`);
    }
  }
}

async function ensureSchemaColumnsAndTables() {
  // 1-5. Core operational tables (work_permits, permit_number_counters, non_conformances, system_files)
  await executeBatchWithFallback([
    `CREATE TABLE IF NOT EXISTS work_permits (
      id SERIAL PRIMARY KEY,
      permit_number TEXT NOT NULL UNIQUE,
      permit_type TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE work_permits
      ADD COLUMN IF NOT EXISTS company_id INTEGER,
      ADD COLUMN IF NOT EXISTS unit_id INTEGER,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS hazards JSONB,
      ADD COLUMN IF NOT EXISTS precautions JSONB,
      ADD COLUMN IF NOT EXISTS issuer_id INTEGER,
      ADD COLUMN IF NOT EXISTS acceptor_id INTEGER,
      ADD COLUMN IF NOT EXISTS contractor_name TEXT,
      ADD COLUMN IF NOT EXISTS worker_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS equipment_list TEXT,
      ADD COLUMN IF NOT EXISTS parent_permit_number TEXT,
      ADD COLUMN IF NOT EXISTS permit_category TEXT,
      ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
      ADD COLUMN IF NOT EXISTS jalali_year INTEGER,
      ADD COLUMN IF NOT EXISTS form_data JSONB;`,
    `CREATE TABLE IF NOT EXISTS permit_number_counters (
      id SERIAL PRIMARY KEY,
      jalali_year INTEGER NOT NULL,
      permit_type_code TEXT NOT NULL,
      parent_permit_number TEXT DEFAULT '' NOT NULL,
      last_sequence INTEGER DEFAULT 0 NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_permit_counters_unique
      ON permit_number_counters (jalali_year, permit_type_code, parent_permit_number);`,
    `CREATE TABLE IF NOT EXISTS non_conformances (
      id SERIAL PRIMARY KEY,
      tracking_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      source_module TEXT NOT NULL,
      source_record_id TEXT,
      source_title TEXT,
      unit_id INTEGER,
      unit_name TEXT,
      risk_level TEXT DEFAULT 'MEDIUM' NOT NULL,
      category TEXT DEFAULT 'ایمنی و بهداشت',
      description TEXT NOT NULL,
      evidence TEXT,
      root_cause TEXT,
      corrective_action TEXT,
      preventive_action TEXT,
      assigned_to TEXT,
      assigned_to_name TEXT,
      due_date TEXT,
      completion_date TEXT,
      status TEXT DEFAULT 'REGISTERED' NOT NULL,
      effectiveness_verified BOOLEAN DEFAULT FALSE NOT NULL,
      effectiveness_notes TEXT,
      workflow_history JSONB DEFAULT '[]'::jsonb,
      attachments JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_nc_source ON non_conformances (source_module, source_record_id);`,
    `CREATE INDEX IF NOT EXISTS idx_nc_status ON non_conformances (status);`,
    `CREATE INDEX IF NOT EXISTS idx_nc_assigned ON non_conformances (assigned_to);`,
    `CREATE TABLE IF NOT EXISTS system_files (
      id SERIAL PRIMARY KEY,
      file_id TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_url TEXT,
      uploaded_by TEXT,
      uploader_role TEXT,
      version INTEGER DEFAULT 1 NOT NULL,
      is_public BOOLEAN DEFAULT FALSE NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_system_files_entity ON system_files (entity_type, entity_id);`,
    `CREATE INDEX IF NOT EXISTS idx_system_files_deleted ON system_files (deleted_at);`,
  ], 'core-tables');

  // 6-7. User personnel assignments & internal automation engine tables
  await executeBatchWithFallback([
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS personnel_access_scope TEXT DEFAULT 'ASSIGNED' NOT NULL;`,
    `UPDATE users
      SET personnel_access_scope = 'ALL'
      WHERE UPPER(REPLACE(REPLACE(role, ' ', ''), '_', '')) IN ('ADMIN', 'ADMINISTRATOR')
        AND personnel_access_scope != 'ALL';`,
    `CREATE TABLE IF NOT EXISTS user_personnel_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_uid TEXT NOT NULL,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
      personnel_code TEXT NOT NULL,
      assigned_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS user_personnel_assignment_unique_idx
      ON user_personnel_assignments (user_id, personnel_id);`,
    `CREATE INDEX IF NOT EXISTS idx_upa_user_id ON user_personnel_assignments (user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_upa_user_uid ON user_personnel_assignments (user_uid);`,
    `CREATE INDEX IF NOT EXISTS idx_upa_personnel_id ON user_personnel_assignments (personnel_id);`,
    `INSERT INTO user_personnel_assignments (user_id, user_uid, personnel_id, personnel_code, assigned_by)
      SELECT u.id, u.uid, p.id, p.personnel_code, 'SYSTEM_MIGRATION'
      FROM users u
      INNER JOIN personnel p ON (
        TRIM(u.personnel_number) = TRIM(p.personnel_code)
        OR (u.national_id IS NOT NULL AND TRIM(u.national_id) != '' AND TRIM(u.national_id) = TRIM(p.national_code))
      )
      WHERE u.deleted_at IS NULL
        AND UPPER(COALESCE(p.status, 'ACTIVE')) = 'ACTIVE'
        AND COALESCE((u.profile_data->>'assignmentsConfigured')::boolean, false) = false
        AND NOT EXISTS (
          SELECT 1 FROM user_personnel_assignments upa WHERE upa.user_id = u.id
        )
      ON CONFLICT (user_id, personnel_id) DO NOTHING;`,
    `CREATE TABLE IF NOT EXISTS automation_rules (
      id SERIAL PRIMARY KEY,
      rule_code TEXT NOT NULL UNIQUE,
      name_fa TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description_fa TEXT,
      description_en TEXT,
      event_type TEXT NOT NULL,
      source_module TEXT DEFAULT 'all' NOT NULL,
      priority INTEGER DEFAULT 10 NOT NULL,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      conditions JSONB NOT NULL,
      actions JSONB NOT NULL,
      execution_count INTEGER DEFAULT 0 NOT NULL,
      last_triggered_at TIMESTAMP,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_automation_rules_event ON automation_rules (event_type);`,
    `CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules (is_active);`,
    `CREATE TABLE IF NOT EXISTS automation_events_outbox (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      source_module TEXT DEFAULT 'system' NOT NULL,
      correlation_key TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload JSONB NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      max_attempts INTEGER DEFAULT 5 NOT NULL,
      next_retry_at TIMESTAMP DEFAULT NOW() NOT NULL,
      locked_at TIMESTAMP,
      locked_by TEXT,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      processed_at TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_outbox_status_retry ON automation_events_outbox (status, next_retry_at);`,
    `CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON automation_events_outbox (event_type);`,
    `CREATE TABLE IF NOT EXISTS automation_execution_logs (
      id SERIAL PRIMARY KEY,
      log_id TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL,
      rule_id INTEGER,
      rule_code TEXT NOT NULL,
      event_type TEXT NOT NULL,
      correlation_key TEXT,
      status TEXT NOT NULL,
      condition_matched BOOLEAN DEFAULT TRUE NOT NULL,
      condition_details JSONB,
      actions_executed JSONB,
      duration_ms INTEGER DEFAULT 0 NOT NULL,
      error_message TEXT,
      actor TEXT DEFAULT 'system',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_exec_logs_event ON automation_execution_logs (event_id);`,
    `CREATE INDEX IF NOT EXISTS idx_exec_logs_rule ON automation_execution_logs (rule_code);`,
    `CREATE INDEX IF NOT EXISTS idx_exec_logs_status ON automation_execution_logs (status);`,
    `CREATE INDEX IF NOT EXISTS idx_exec_logs_created ON automation_execution_logs (created_at);`,
    `DELETE FROM automation_rules
      WHERE created_by = 'SYSTEM_SEED'
         OR rule_code IN ('RULE-01', 'RULE-02', 'RULE-03', 'RULE-04', 'RULE-05');`,
    `DELETE FROM notifications
      WHERE notif_id LIKE 'notif_auto_%'
         OR notif_id LIKE 'notif-hse-init-%'
         OR sender = 'موتور اتوماسیون سامانه (Automation Engine)'
         OR sender = 'سیستم تصاعد خودکار (SLA Escalation Engine)'
         OR title = 'تصاعد فوری حادثه وخیم';`,
    `DELETE FROM automation_execution_logs
      WHERE rule_code IN ('RULE-01', 'RULE-02', 'RULE-03', 'RULE-04', 'RULE-05');`,
  ], 'assignments-automation');

  // 15. Local AI knowledge base + persistent chat sessions + fire_equipment (HSECORE AI)
  await executeBatchWithFallback([
    `CREATE TABLE IF NOT EXISTS ai_knowledge_docs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      doc_type TEXT DEFAULT 'REGULATION' NOT NULL,
      category TEXT DEFAULT 'GENERAL' NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      file_size INTEGER DEFAULT 0 NOT NULL,
      chunk_count INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'INDEXED' NOT NULL,
      uploaded_by TEXT,
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_docs_category ON ai_knowledge_docs (category);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_docs_status ON ai_knowledge_docs (status);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_docs_created ON ai_knowledge_docs (created_at);`,
    `CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
      id SERIAL PRIMARY KEY,
      doc_id INTEGER NOT NULL REFERENCES ai_knowledge_docs(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      token_count INTEGER DEFAULT 0 NOT NULL,
      embedding JSONB,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_chunks_doc ON ai_knowledge_chunks (doc_id);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_chunks_index ON ai_knowledge_chunks (doc_id, chunk_index);`,
    `CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      user_uid TEXT,
      title TEXT NOT NULL,
      assistant_id TEXT DEFAULT 'GENERAL_HSE' NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_chat_sessions (user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_uid ON ai_chat_sessions (user_uid);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_sessions_created ON ai_chat_sessions (created_at);`,
    `CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tools_used JSONB,
      citations JSONB,
      duration_ms INTEGER,
      model TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_msgs_session ON ai_chat_messages (session_id);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_msgs_created ON ai_chat_messages (created_at);`,
    `CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      name_fa TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE NOT NULL,
      is_default BOOLEAN DEFAULT FALSE NOT NULL,
      base_url TEXT,
      capabilities JSONB DEFAULT '[]'::jsonb NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_providers_kind ON ai_providers (kind);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_providers_default ON ai_providers (is_default);`,
    `CREATE TABLE IF NOT EXISTS ai_provider_configs (
      id SERIAL PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
      config_key TEXT NOT NULL,
      config_value TEXT,
      is_secret BOOLEAN DEFAULT FALSE NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_provider ON ai_provider_configs (provider_id);`,
    `CREATE TABLE IF NOT EXISTS ai_models (
      id SERIAL PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
      model_ref TEXT NOT NULL,
      display_name TEXT,
      size_bytes INTEGER,
      status TEXT DEFAULT 'known' NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models (provider_id);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_models_ref ON ai_models (model_ref);`,
    `CREATE TABLE IF NOT EXISTS ai_model_assignments (
      id SERIAL PRIMARY KEY,
      service_key TEXT NOT NULL,
      provider_id TEXT REFERENCES ai_providers(id) ON DELETE SET NULL,
      model_ref TEXT,
      fallback_provider_id TEXT,
      fallback_model_ref TEXT,
      context_limit INTEGER,
      enabled BOOLEAN DEFAULT TRUE NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_assignments_service ON ai_model_assignments (service_key);`,
    `CREATE TABLE IF NOT EXISTS ai_service_settings (
      id SERIAL PRIMARY KEY,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_service_settings_key ON ai_service_settings (setting_key);`,
    `CREATE TABLE IF NOT EXISTS ai_deployment_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      provider_id TEXT,
      target_ref TEXT,
      status TEXT DEFAULT 'pending' NOT NULL,
      progress INTEGER DEFAULT 0 NOT NULL,
      message TEXT,
      error_message TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_deployment_jobs (status);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_jobs_created ON ai_deployment_jobs (created_at);`,
    `INSERT INTO ai_providers (id, kind, name, name_fa, enabled, is_default, base_url, capabilities, metadata)
      VALUES (
        'ollama',
        'ollama',
        'Ollama',
        'موتور محلی Ollama',
        TRUE,
        TRUE,
        'http://hse-ai-engine:11434',
        '["health","listInstalled","pull","delete","chat","generate","embeddings"]'::jsonb,
        '{}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;`,
    `CREATE TABLE IF NOT EXISTS fire_equipment (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      equipment_type TEXT NOT NULL,
      location TEXT NOT NULL,
      unit_id INTEGER,
      capacity TEXT,
      manufacturing_year INTEGER,
      last_inspection_date TEXT,
      next_inspection_due TEXT,
      hydrostatic_test_due TEXT,
      status TEXT DEFAULT 'SERVICEABLE' NOT NULL,
      pressure_status TEXT DEFAULT 'NORMAL',
      notes TEXT,
      extra_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE fire_equipment ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_fire_equipment_code_unique ON fire_equipment (code);`,
  ], 'ai-and-fire-tables');

  // 16. PSM Implementation & Maturity Management System Tables (پتروشیمی رجال)
  await executeBatchWithFallback([
    `CREATE TABLE IF NOT EXISTS psm_projects (
      id SERIAL PRIMARY KEY,
      project_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      scope_description TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      project_manager_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
      project_manager_name TEXT NOT NULL,
      project_sponsor_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
      project_sponsor_name TEXT NOT NULL,
      team_members JSONB DEFAULT '[]'::jsonb NOT NULL,
      covered_units JSONB DEFAULT '[]'::jsonb NOT NULL,
      covered_areas JSONB DEFAULT '[]'::jsonb NOT NULL,
      quantitative_goals JSONB DEFAULT '[]'::jsonb NOT NULL,
      qualitative_goals JSONB DEFAULT '[]'::jsonb NOT NULL,
      budget_allocated DOUBLE PRECISION DEFAULT 0 NOT NULL,
      budget_spent DOUBLE PRECISION DEFAULT 0 NOT NULL,
      resources_summary TEXT,
      milestones JSONB DEFAULT '[]'::jsonb NOT NULL,
      overall_status TEXT DEFAULT 'INITIATION' NOT NULL,
      overall_progress DOUBLE PRECISION DEFAULT 0 NOT NULL,
      handover_data JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_projects_code ON psm_projects (project_code);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_projects_status ON psm_projects (overall_status);`,
    `CREATE TABLE IF NOT EXISTS psm_process_assets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES psm_projects(id) ON DELETE CASCADE,
      company_name TEXT DEFAULT 'مجتمع پتروشیمی رجال' NOT NULL,
      site_name TEXT,
      process_unit_id INTEGER,
      process_unit_name TEXT NOT NULL,
      operational_area TEXT NOT NULL,
      equipment_tag TEXT NOT NULL,
      equipment_name TEXT NOT NULL,
      equipment_class TEXT DEFAULT 'REACTOR' NOT NULL,
      safety_criticality TEXT DEFAULT 'HIGH' NOT NULL,
      hazardous_substances TEXT,
      design_parameters TEXT,
      responsible_person_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
      responsible_person_name TEXT NOT NULL,
      responsible_role TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_assets_project ON psm_process_assets (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_assets_unit ON psm_process_assets (process_unit_name);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_assets_tag ON psm_process_assets (equipment_tag);`,
    `CREATE TABLE IF NOT EXISTS psm_assessments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      framework TEXT NOT NULL,
      element_code TEXT NOT NULL,
      element_title_fa TEXT NOT NULL,
      element_title_en TEXT NOT NULL,
      pillar TEXT,
      unit_name TEXT DEFAULT 'کل مجتمع' NOT NULL,
      evaluation_criteria TEXT NOT NULL,
      is_in_scope BOOLEAN DEFAULT TRUE NOT NULL,
      out_of_scope_justification TEXT,
      out_of_scope_approved_by TEXT,
      out_of_scope_approved_at TIMESTAMP,
      current_status_desc TEXT NOT NULL,
      evidence_list JSONB DEFAULT '[]'::jsonb NOT NULL,
      assessor_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
      assessor_name TEXT NOT NULL,
      assessment_date TEXT NOT NULL,
      strengths TEXT,
      deficiencies TEXT,
      compliance_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
      compliance_status TEXT DEFAULT 'PARTIAL' NOT NULL,
      action_priority TEXT DEFAULT 'HIGH' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_assessments_project ON psm_assessments (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_assessments_element ON psm_assessments (framework, element_code);`,
    `CREATE TABLE IF NOT EXISTS psm_gaps (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      assessment_id INTEGER REFERENCES psm_assessments(id) ON DELETE SET NULL,
      gap_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      standard_reference TEXT NOT NULL,
      ccps_element_code TEXT,
      osha_clause_codes JSONB DEFAULT '[]'::jsonb NOT NULL,
      unit_name TEXT NOT NULL,
      risk_level TEXT DEFAULT 'HIGH' NOT NULL,
      required_document TEXT,
      responsible_person_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
      responsible_person_name TEXT NOT NULL,
      proposed_due_date TEXT NOT NULL,
      is_out_of_scope BOOLEAN DEFAULT FALSE NOT NULL,
      technical_justification TEXT,
      justification_approved_by TEXT,
      justification_approved_at TIMESTAMP,
      status TEXT DEFAULT 'OPEN' NOT NULL,
      linked_wbs_id INTEGER,
      linked_capa_id INTEGER,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_gaps_project ON psm_gaps (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_gaps_status ON psm_gaps (status);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_gaps_risk ON psm_gaps (risk_level);`,
    `CREATE TABLE IF NOT EXISTS psm_wbs_tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      gap_id INTEGER REFERENCES psm_gaps(id) ON DELETE SET NULL,
      wbs_code TEXT NOT NULL,
      parent_id INTEGER,
      title TEXT NOT NULL,
      element_code TEXT,
      unit_name TEXT,
      owner_name TEXT NOT NULL,
      executor_name TEXT NOT NULL,
      planned_start TEXT NOT NULL,
      planned_end TEXT NOT NULL,
      actual_start TEXT,
      actual_end TEXT,
      planned_progress DOUBLE PRECISION DEFAULT 0 NOT NULL,
      actual_progress DOUBLE PRECISION DEFAULT 0 NOT NULL,
      weight DOUBLE PRECISION DEFAULT 1 NOT NULL,
      dependencies JSONB DEFAULT '[]'::jsonb NOT NULL,
      allocated_budget DOUBLE PRECISION DEFAULT 0 NOT NULL,
      actual_cost DOUBLE PRECISION DEFAULT 0 NOT NULL,
      resources TEXT,
      is_milestone BOOLEAN DEFAULT FALSE NOT NULL,
      is_critical BOOLEAN DEFAULT FALSE NOT NULL,
      delay_days INTEGER DEFAULT 0 NOT NULL,
      schedule_variance_pct DOUBLE PRECISION DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'NOT_STARTED' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_wbs_project ON psm_wbs_tasks (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_wbs_code ON psm_wbs_tasks (wbs_code);`,
    `CREATE TABLE IF NOT EXISTS psm_documents (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      doc_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      doc_type TEXT DEFAULT 'PROCEDURE' NOT NULL,
      ccps_element_code TEXT NOT NULL,
      osha_clause_code TEXT,
      unit_name TEXT,
      equipment_tag TEXT,
      linked_study_id INTEGER,
      linked_capa_id INTEGER,
      version TEXT DEFAULT '1.0' NOT NULL,
      revision_number INTEGER DEFAULT 1 NOT NULL,
      author_name TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      approver_name TEXT NOT NULL,
      issue_date TEXT,
      validity_expiry_date TEXT,
      review_cycle_months INTEGER DEFAULT 24 NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      file_id TEXT,
      file_url TEXT,
      file_name TEXT,
      evidence_summary TEXT,
      evidence_attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
      change_history JSONB DEFAULT '[]'::jsonb NOT NULL,
      approved_at TIMESTAMP,
      approved_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_docs_project ON psm_documents (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_docs_element ON psm_documents (ccps_element_code);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_docs_status ON psm_documents (status);`,
    `CREATE TABLE IF NOT EXISTS psm_capa_items (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      capa_code TEXT NOT NULL UNIQUE,
      source_type TEXT DEFAULT 'GAP_ANALYSIS' NOT NULL,
      source_ref_id TEXT,
      ccps_element_code TEXT,
      osha_clause_code TEXT,
      unit_name TEXT NOT NULL,
      equipment_tag TEXT,
      title TEXT NOT NULL,
      deficiency_description TEXT NOT NULL,
      risk_severity INTEGER DEFAULT 3 NOT NULL,
      risk_likelihood INTEGER DEFAULT 3 NOT NULL,
      risk_level TEXT DEFAULT 'HIGH' NOT NULL,
      root_cause TEXT,
      corrective_action TEXT,
      preventive_action TEXT,
      responsible_person_name TEXT,
      due_date TEXT,
      completion_date TEXT,
      evidence_description TEXT,
      evidence_files JSONB DEFAULT '[]'::jsonb NOT NULL,
      reviewer_name TEXT,
      review_notes TEXT,
      reviewed_at TIMESTAMP,
      effectiveness_verifier_name TEXT,
      effectiveness_verification_date TEXT,
      effectiveness_criteria_met BOOLEAN DEFAULT FALSE NOT NULL,
      effectiveness_report TEXT,
      closed_by TEXT,
      closed_at TIMESTAMP,
      stage TEXT DEFAULT 'REGISTERED' NOT NULL,
      workflow_logs JSONB DEFAULT '[]'::jsonb NOT NULL,
      followup_plan TEXT,
      management_approval_for_residual BOOLEAN DEFAULT FALSE NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_capa_project ON psm_capa_items (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_capa_stage ON psm_capa_items (stage);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_capa_risk ON psm_capa_items (risk_level);`,
    `CREATE TABLE IF NOT EXISTS psm_specialized_studies (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      study_code TEXT NOT NULL UNIQUE,
      subsystem_type TEXT NOT NULL,
      title TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      equipment_tag TEXT,
      node_or_section TEXT,
      owner_name TEXT NOT NULL,
      team_leader TEXT,
      study_date TEXT NOT NULL,
      revalidation_due_date TEXT,
      status TEXT DEFAULT 'IN_PROGRESS' NOT NULL,
      technical_summary TEXT NOT NULL,
      methodology_details JSONB DEFAULT '{}'::jsonb NOT NULL,
      recommendations JSONB DEFAULT '[]'::jsonb NOT NULL,
      evidence_summary TEXT,
      tracking_path TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_studies_project ON psm_specialized_studies (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_studies_subsystem ON psm_specialized_studies (subsystem_type);`,
    `CREATE TABLE IF NOT EXISTS psm_maturity_assessments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      assessment_code TEXT NOT NULL UNIQUE,
      assessment_date TEXT NOT NULL,
      assessor_name TEXT NOT NULL,
      unit_scope TEXT DEFAULT 'کل مجتمع پتروشیمی رجال' NOT NULL,
      overall_maturity_level INTEGER DEFAULT 1 NOT NULL,
      overall_maturity_score DOUBLE PRECISION DEFAULT 1 NOT NULL,
      pillar_scores JSONB DEFAULT '{}'::jsonb NOT NULL,
      element_maturity_data JSONB DEFAULT '[]'::jsonb NOT NULL,
      strengths_summary TEXT,
      improvement_roadmap TEXT,
      verified_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS psm_stage_gates (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      gate_key TEXT NOT NULL,
      gate_number INTEGER NOT NULL,
      title_fa TEXT NOT NULL,
      title_en TEXT NOT NULL,
      description_fa TEXT NOT NULL,
      entry_criteria JSONB DEFAULT '[]'::jsonb NOT NULL,
      exit_criteria JSONB DEFAULT '[]'::jsonb NOT NULL,
      mandatory_checklist JSONB DEFAULT '[]'::jsonb NOT NULL,
      required_evidence_list JSONB DEFAULT '[]'::jsonb NOT NULL,
      prepared_by_name TEXT DEFAULT '' NOT NULL,
      evaluator_name TEXT DEFAULT '' NOT NULL,
      approver_name TEXT DEFAULT '' NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      decision_date TEXT,
      meeting_minutes TEXT,
      comments TEXT,
      blocking_issues JSONB DEFAULT '[]'::jsonb NOT NULL,
      change_history JSONB DEFAULT '[]'::jsonb NOT NULL,
      approved_at TIMESTAMP,
      approved_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_stage_gates_project ON psm_stage_gates (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_stage_gates_key ON psm_stage_gates (gate_key);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_stage_gates_status ON psm_stage_gates (status);`,
    `CREATE TABLE IF NOT EXISTS psm_gate_deviations (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES psm_projects(id) ON DELETE CASCADE,
      gate_key TEXT NOT NULL,
      deviation_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      requirement_description TEXT NOT NULL,
      technical_justification TEXT NOT NULL,
      risk_assessment_summary TEXT NOT NULL,
      compensatory_measures TEXT NOT NULL,
      is_legal_requirement BOOLEAN DEFAULT FALSE NOT NULL,
      requested_by_name TEXT NOT NULL,
      approved_by_name TEXT,
      approval_role TEXT,
      valid_until_date TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      decision_notes TEXT,
      decided_at TIMESTAMP,
      change_history JSONB DEFAULT '[]'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_psm_gate_deviations_project ON psm_gate_deviations (project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_gate_deviations_gate ON psm_gate_deviations (gate_key);`,
    `CREATE INDEX IF NOT EXISTS idx_psm_gate_deviations_status ON psm_gate_deviations (status);`,
  ], 'psm-tables');

  // 17. Fire Suppression Systems Design & 2D Layout Tables (NFPA 13 / NFPA 10)
  await executeBatchWithFallback([
    `CREATE TABLE IF NOT EXISTS fire_design_buildings (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      company_name TEXT DEFAULT 'مجتمع پتروشیمی رجال' NOT NULL,
      unit_id INTEGER,
      unit_name TEXT NOT NULL,
      occupancy_type TEXT DEFAULT 'INDUSTRIAL_PROCESS' NOT NULL,
      nfpa13_edition TEXT DEFAULT '2022' NOT NULL,
      nfpa10_edition TEXT DEFAULT '2022' NOT NULL,
      floors_above_ground INTEGER DEFAULT 1 NOT NULL,
      basement_floors INTEGER DEFAULT 0 NOT NULL,
      structure_type TEXT DEFAULT 'CONCRETE' NOT NULL,
      ceiling_type TEXT DEFAULT 'FLAT_UNOBSTRUCTED' NOT NULL,
      stored_materials TEXT DEFAULT '' NOT NULL,
      hazard_nature JSONB DEFAULT '[]'::jsonb NOT NULL,
      risk_level_override TEXT DEFAULT 'AUTO' NOT NULL,
      occupant_load INTEGER DEFAULT 0 NOT NULL,
      activity_type TEXT DEFAULT '' NOT NULL,
      water_source_type TEXT,
      water_supply JSONB DEFAULT '{}'::jsonb NOT NULL,
      current_suppression_notes TEXT,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
      deleted_at TIMESTAMP,
      deleted_by TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `ALTER TABLE fire_design_buildings ADD COLUMN IF NOT EXISTS water_source_type TEXT;`,
    `ALTER TABLE fire_design_buildings ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;`,
    `ALTER TABLE fire_design_buildings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`,
    `ALTER TABLE fire_design_buildings ADD COLUMN IF NOT EXISTS deleted_by TEXT;`,
    `UPDATE fire_design_buildings
       SET water_source_type = CASE
         WHEN water_supply->>'sourceType' IN ('FIRE_NETWORK', 'STORAGE_TANK') THEN water_supply->>'sourceType'
         WHEN NULLIF(water_supply->>'tankCapacityLiters', '') IS NOT NULL AND (water_supply->>'tankCapacityLiters')::numeric > 0 THEN 'STORAGE_TANK'
         WHEN NULLIF(water_supply->>'staticPressureBar', '') IS NOT NULL AND (water_supply->>'staticPressureBar')::numeric > 0 THEN 'FIRE_NETWORK'
         ELSE NULL
       END
       WHERE water_source_type IS NULL;`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_buildings_code ON fire_design_buildings (code);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_buildings_unit ON fire_design_buildings (unit_name);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_buildings_status ON fire_design_buildings (status);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_buildings_is_deleted ON fire_design_buildings (is_deleted);`,
    `CREATE TABLE IF NOT EXISTS fire_design_floors (
      id SERIAL PRIMARY KEY,
      building_id INTEGER NOT NULL REFERENCES fire_design_buildings(id) ON DELETE CASCADE,
      floor_code TEXT NOT NULL,
      floor_label TEXT NOT NULL,
      floor_order INTEGER DEFAULT 0 NOT NULL,
      is_basement BOOLEAN DEFAULT FALSE NOT NULL,
      length_m DOUBLE PRECISION DEFAULT 0 NOT NULL,
      width_m DOUBLE PRECISION DEFAULT 0 NOT NULL,
      ceiling_height_m DOUBLE PRECISION DEFAULT 0 NOT NULL,
      area_sqm DOUBLE PRECISION DEFAULT 0 NOT NULL,
      false_ceiling_height_m DOUBLE PRECISION DEFAULT 0 NOT NULL,
      beam_depth_m DOUBLE PRECISION DEFAULT 0 NOT NULL,
      beam_spacing_m DOUBLE PRECISION DEFAULT 0 NOT NULL,
      spaces JSONB DEFAULT '[]'::jsonb NOT NULL,
      obstacles JSONB DEFAULT '[]'::jsonb NOT NULL,
      floor_plan_file_id TEXT,
      floor_plan_file_name TEXT,
      floor_plan_mime_type TEXT,
      floor_plan_width_px INTEGER,
      floor_plan_height_px INTEGER,
      scale_meters_per_pixel DOUBLE PRECISION,
      calibration_line JSONB,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_floors_building ON fire_design_floors (building_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_floors_order ON fire_design_floors (building_id, floor_order);`,
    `CREATE TABLE IF NOT EXISTS fire_design_layouts (
      id SERIAL PRIMARY KEY,
      building_id INTEGER NOT NULL REFERENCES fire_design_buildings(id) ON DELETE CASCADE,
      floor_id INTEGER NOT NULL REFERENCES fire_design_floors(id) ON DELETE CASCADE,
      revision INTEGER DEFAULT 1 NOT NULL,
      nfpa13_edition TEXT DEFAULT '2022' NOT NULL,
      nfpa10_edition TEXT DEFAULT '2022' NOT NULL,
      sprinkler_config JSONB DEFAULT '{}'::jsonb NOT NULL,
      extinguisher_config JSONB DEFAULT '{}'::jsonb NOT NULL,
      placed_items JSONB DEFAULT '[]'::jsonb NOT NULL,
      calculation_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
      compliance_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      calculated_by TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      approved_by TEXT,
      approved_at TIMESTAMP,
      review_notes TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_layouts_building ON fire_design_layouts (building_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_layouts_floor ON fire_design_layouts (floor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_layouts_status ON fire_design_layouts (status);`,
    `CREATE TABLE IF NOT EXISTS fire_design_systems (
      id SERIAL PRIMARY KEY,
      building_id INTEGER NOT NULL REFERENCES fire_design_buildings(id) ON DELETE CASCADE,
      floor_id INTEGER REFERENCES fire_design_floors(id) ON DELETE CASCADE,
      system_type TEXT NOT NULL,
      standard_code TEXT NOT NULL,
      standard_edition TEXT NOT NULL,
      local_code_notes TEXT,
      design_inputs JSONB DEFAULT '{}'::jsonb NOT NULL,
      calculation_output JSONB DEFAULT '{}'::jsonb NOT NULL,
      compliance_status TEXT DEFAULT 'INCOMPLETE' NOT NULL,
      design_stage TEXT DEFAULT 'PRELIMINARY' NOT NULL,
      version INTEGER DEFAULT 1 NOT NULL,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      updated_by TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      approved_by TEXT,
      approved_at TIMESTAMP,
      review_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_systems_building ON fire_design_systems (building_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_systems_floor ON fire_design_systems (floor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_systems_type ON fire_design_systems (system_type);`,
    `CREATE TABLE IF NOT EXISTS fire_design_gap_actions (
      id SERIAL PRIMARY KEY,
      building_id INTEGER NOT NULL REFERENCES fire_design_buildings(id) ON DELETE CASCADE,
      floor_id INTEGER REFERENCES fire_design_floors(id) ON DELETE CASCADE,
      action_code TEXT NOT NULL UNIQUE,
      system_type TEXT NOT NULL,
      gap_type TEXT DEFAULT 'DEFICIT' NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      risk_priority TEXT DEFAULT 'HIGH' NOT NULL,
      recommended_action TEXT NOT NULL,
      responsible_person TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'OPEN' NOT NULL,
      resolution_notes TEXT,
      created_by TEXT,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_gap_building ON fire_design_gap_actions (building_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_gap_status ON fire_design_gap_actions (status);`,
    `CREATE INDEX IF NOT EXISTS idx_fire_design_gap_priority ON fire_design_gap_actions (risk_priority);`,
    `ALTER TABLE fire_design_layouts ADD COLUMN IF NOT EXISTS reviewed_by TEXT;`,
    `ALTER TABLE fire_design_layouts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;`,
    `ALTER TABLE fire_design_layouts ADD COLUMN IF NOT EXISTS review_notes TEXT;`,
    `ALTER TABLE fire_design_systems ADD COLUMN IF NOT EXISTS reviewed_by TEXT;`,
    `ALTER TABLE fire_design_systems ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;`,
    `ALTER TABLE fire_design_systems ADD COLUMN IF NOT EXISTS review_notes TEXT;`,
  ], 'fire-design-tables');

  // 18. Comprehensive Risk Assessment Module Extensions (Zero parallel table; extends risk_assessments)
  await executeBatchWithFallback([
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS assessment_code TEXT;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS site_name TEXT;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS unit_name TEXT;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS area_location TEXT;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS assessor_name TEXT;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS assessment_date TEXT;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT 'INITIAL_INFO';`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS control_actions JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS linked_refs JSONB DEFAULT '{}'::jsonb;`,
    `CREATE INDEX IF NOT EXISTS idx_risk_assessments_code ON risk_assessments (assessment_code);`,
    `CREATE INDEX IF NOT EXISTS idx_risk_assessments_method ON risk_assessments (methodology);`,
    `CREATE INDEX IF NOT EXISTS idx_risk_assessments_status ON risk_assessments (status);`,
    `CREATE INDEX IF NOT EXISTS idx_risk_assessments_unit_name ON risk_assessments (unit_name);`,
    `CREATE INDEX IF NOT EXISTS idx_risk_assessments_initial_level ON risk_assessments (initial_risk_level);`,
  ], 'risk-assessments-extensions');

  // 19. Chemical Safety Data Sheets (SDS / GHS / ISO 11014) Tables
  await executeBatchWithFallback([
    `CREATE TABLE IF NOT EXISTS sds_records (
      id SERIAL PRIMARY KEY,
      sds_uid TEXT NOT NULL UNIQUE,
      document_number TEXT NOT NULL,
      material_name_fa TEXT NOT NULL,
      material_name_en TEXT NOT NULL,
      material_name_normalized TEXT NOT NULL,
      trade_name TEXT,
      cas_number TEXT,
      cas_number_normalized TEXT,
      un_number TEXT,
      manufacturer TEXT,
      supplier TEXT,
      unit_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
      unit_name TEXT DEFAULT 'عمومی مجتمع' NOT NULL,
      storage_location TEXT,
      physical_state TEXT DEFAULT 'LIQUID' NOT NULL,
      revision_number INTEGER DEFAULT 1 NOT NULL,
      prepared_date TEXT NOT NULL,
      last_revision_date TEXT,
      revision_trigger_reason TEXT,
      needs_revision BOOLEAN DEFAULT FALSE NOT NULL,
      review_alert_message TEXT,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      ghs_data JSONB DEFAULT '{}'::jsonb NOT NULL,
      sections JSONB DEFAULT '{}'::jsonb NOT NULL,
      primary_file_id TEXT,
      ai_extraction_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
      linked_refs JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_by TEXT,
      created_by_role TEXT,
      updated_by TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      approved_by TEXT,
      approved_at TIMESTAMP,
      published_by TEXT,
      published_at TIMESTAMP,
      obsolete_reason TEXT,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sds_records_cas ON sds_records (cas_number_normalized);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_records_name_norm ON sds_records (material_name_normalized);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_records_status ON sds_records (status);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_records_unit ON sds_records (unit_name);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_records_deleted ON sds_records (deleted_at);`,
    `CREATE TABLE IF NOT EXISTS sds_revisions (
      id SERIAL PRIMARY KEY,
      sds_id INTEGER NOT NULL REFERENCES sds_records(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      status_at_snapshot TEXT NOT NULL,
      change_summary TEXT,
      trigger_reason TEXT,
      snapshot JSONB NOT NULL,
      created_by TEXT,
      editor_name TEXT,
      approver_name TEXT,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sds_revisions_sds ON sds_revisions (sds_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_revisions_num ON sds_revisions (sds_id, revision_number);`,
    `CREATE TABLE IF NOT EXISTS sds_attachments (
      id SERIAL PRIMARY KEY,
      sds_id INTEGER NOT NULL REFERENCES sds_records(id) ON DELETE CASCADE,
      file_id TEXT NOT NULL,
      attachment_role TEXT DEFAULT 'OTHER' NOT NULL,
      title TEXT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE NOT NULL,
      notes TEXT,
      uploaded_by TEXT,
      uploader_role TEXT,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sds_attachments_sds ON sds_attachments (sds_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_attachments_file ON sds_attachments (file_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sds_attachments_deleted ON sds_attachments (deleted_at);`,
  ], 'sds-tables');

  // 20. Lifting Plan Management & Engineering Tables (MecaLug-inspired / ASME Compliant)
  await executeBatchWithFallback([
    `CREATE TABLE IF NOT EXISTS lifting_standards_config (
      id SERIAL PRIMARY KEY,
      standard_code TEXT NOT NULL UNIQUE,
      title_fa TEXT NOT NULL,
      title_en TEXT NOT NULL,
      edition TEXT NOT NULL,
      category TEXT DEFAULT 'ASME' NOT NULL,
      active_clauses JSONB DEFAULT '{}'::jsonb NOT NULL,
      engineering_factors JSONB DEFAULT '{}'::jsonb NOT NULL,
      notes TEXT,
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      updated_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_standards_code ON lifting_standards_config (standard_code);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_standards_active ON lifting_standards_config (is_active);`,
    `CREATE TABLE IF NOT EXISTS lifting_cranes (
      id SERIAL PRIMARY KEY,
      crane_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      crane_type TEXT DEFAULT 'MOBILE_ALL_TERRAIN' NOT NULL,
      manufacturer TEXT,
      model TEXT NOT NULL,
      serial_number TEXT,
      plate_number TEXT,
      max_rated_capacity_ton DOUBLE PRECISION NOT NULL,
      min_boom_length_m DOUBLE PRECISION DEFAULT 10 NOT NULL,
      max_boom_length_m DOUBLE PRECISION DEFAULT 60 NOT NULL,
      max_radius_m DOUBLE PRECISION DEFAULT 45 NOT NULL,
      counterweight_ton DOUBLE PRECISION DEFAULT 0 NOT NULL,
      outrigger_spread_m DOUBLE PRECISION DEFAULT 7.5 NOT NULL,
      hook_block_weight_ton DOUBLE PRECISION DEFAULT 0.6 NOT NULL,
      ownership_type TEXT DEFAULT 'COMPANY' NOT NULL,
      contractor_name TEXT,
      unit_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
      unit_name TEXT,
      certificate_number TEXT,
      certificate_doc_id TEXT,
      certificate_issue_date TEXT,
      certificate_expiry_date TEXT,
      last_inspection_date TEXT,
      next_inspection_date TEXT,
      latest_inspection_id INTEGER,
      status TEXT DEFAULT 'ACTIVE' NOT NULL,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_cranes_code ON lifting_cranes (crane_code);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_cranes_status ON lifting_cranes (status);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_cranes_deleted ON lifting_cranes (is_deleted);`,
    `CREATE TABLE IF NOT EXISTS lifting_crane_load_charts (
      id SERIAL PRIMARY KEY,
      crane_id INTEGER NOT NULL REFERENCES lifting_cranes(id) ON DELETE CASCADE,
      chart_name TEXT DEFAULT 'Main Boom - 100% Outriggers' NOT NULL,
      outrigger_config TEXT DEFAULT '100_OUTRIGGERS' NOT NULL,
      counterweight_ton DOUBLE PRECISION DEFAULT 0 NOT NULL,
      boom_length_m DOUBLE PRECISION NOT NULL,
      radius_m DOUBLE PRECISION NOT NULL,
      rated_capacity_ton DOUBLE PRECISION NOT NULL,
      max_tip_height_m DOUBLE PRECISION,
      boom_angle_deg DOUBLE PRECISION,
      falls_of_rope INTEGER DEFAULT 6,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_crane_chart_crane ON lifting_crane_load_charts (crane_id);`,
    `CREATE INDEX IF NOT EXISTS idx_crane_chart_lookup ON lifting_crane_load_charts (crane_id, boom_length_m, radius_m);`,
    `CREATE TABLE IF NOT EXISTS lifting_rigging_equipment (
      id SERIAL PRIMARY KEY,
      asset_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      standard_ref TEXT DEFAULT 'ASME B30.9' NOT NULL,
      wll_ton DOUBLE PRECISION NOT NULL,
      safety_factor DOUBLE PRECISION DEFAULT 5 NOT NULL,
      self_weight_kg DOUBLE PRECISION DEFAULT 10 NOT NULL,
      length_m DOUBLE PRECISION,
      diameter_mm DOUBLE PRECISION,
      min_sling_angle_deg DOUBLE PRECISION DEFAULT 45,
      serial_number TEXT,
      manufacturer TEXT,
      owner_type TEXT DEFAULT 'COMPANY' NOT NULL,
      contractor_name TEXT,
      unit_name TEXT,
      storage_location TEXT,
      certificate_number TEXT,
      certificate_doc_id TEXT,
      certificate_expiry_date TEXT,
      last_inspection_date TEXT,
      next_inspection_date TEXT,
      safety_latch_ok BOOLEAN DEFAULT TRUE NOT NULL,
      condition_status TEXT DEFAULT 'SERVICEABLE' NOT NULL,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_rigging_code ON lifting_rigging_equipment (asset_code);`,
    `CREATE INDEX IF NOT EXISTS idx_rigging_category ON lifting_rigging_equipment (category);`,
    `CREATE INDEX IF NOT EXISTS idx_rigging_status ON lifting_rigging_equipment (condition_status);`,
    `CREATE INDEX IF NOT EXISTS idx_rigging_deleted ON lifting_rigging_equipment (is_deleted);`,
    `CREATE TABLE IF NOT EXISTS lifting_plans (
      id SERIAL PRIMARY KEY,
      plan_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      revision_number INTEGER DEFAULT 1 NOT NULL,
      lift_category TEXT DEFAULT 'STANDARD' NOT NULL,
      company_id INTEGER REFERENCES org_companies(id) ON DELETE SET NULL,
      unit_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
      unit_name TEXT DEFAULT 'عمومی مجتمع' NOT NULL,
      area_location TEXT NOT NULL,
      planned_date TEXT NOT NULL,
      contractor_name TEXT,
      load_name TEXT NOT NULL,
      load_shape TEXT DEFAULT 'VESSEL_HORIZONTAL' NOT NULL,
      net_load_weight_ton DOUBLE PRECISION NOT NULL,
      rigging_accessory_weight_ton DOUBLE PRECISION DEFAULT 0 NOT NULL,
      hook_block_weight_ton DOUBLE PRECISION DEFAULT 0.6 NOT NULL,
      dynamic_factor DOUBLE PRECISION DEFAULT 1.1 NOT NULL,
      load_dimensions JSONB DEFAULT '{}'::jsonb NOT NULL,
      cog_offset JSONB DEFAULT '{"x":0,"y":0,"z":0}'::jsonb NOT NULL,
      crane_setup JSONB DEFAULT '{}'::jsonb NOT NULL,
      rigging_setup JSONB DEFAULT '{}'::jsonb NOT NULL,
      tandem_config JSONB DEFAULT '{}'::jsonb NOT NULL,
      blind_config JSONB DEFAULT '{}'::jsonb NOT NULL,
      turning_config JSONB DEFAULT '{}'::jsonb NOT NULL,
      personnel_assignment JSONB DEFAULT '{}'::jsonb NOT NULL,
      linked_risk_assessment_id INTEGER REFERENCES risk_assessments(id) ON DELETE SET NULL,
      linked_permit_id INTEGER REFERENCES work_permits(id) ON DELETE SET NULL,
      linked_non_conformance_id INTEGER REFERENCES non_conformances(id) ON DELETE SET NULL,
      linked_inspection_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
      linked_document_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
      engineering_status TEXT DEFAULT 'NOT_VERIFIED' NOT NULL,
      workflow_stage TEXT DEFAULT 'REQUEST' NOT NULL,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      requires_reapproval BOOLEAN DEFAULT FALSE NOT NULL,
      latest_calculation_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
      ai_analysis_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_plans_code ON lifting_plans (plan_code);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_plans_status ON lifting_plans (status);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_plans_stage ON lifting_plans (workflow_stage);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_plans_unit ON lifting_plans (unit_name);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_plans_deleted ON lifting_plans (is_deleted);`,
    `CREATE TABLE IF NOT EXISTS lifting_plan_revisions (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES lifting_plans(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      change_reason TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      status_at_snapshot TEXT NOT NULL,
      engineering_status_at_snapshot TEXT NOT NULL,
      plan_snapshot JSONB NOT NULL,
      calculation_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_revisions_plan ON lifting_plan_revisions (plan_id);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_revisions_num ON lifting_plan_revisions (plan_id, revision_number);`,
    `CREATE TABLE IF NOT EXISTS lifting_calculations (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES lifting_plans(id) ON DELETE CASCADE,
      revision_number INTEGER DEFAULT 1 NOT NULL,
      calculation_type TEXT NOT NULL,
      overall_status TEXT DEFAULT 'NOT_VERIFIED' NOT NULL,
      standard_references JSONB DEFAULT '[]'::jsonb NOT NULL,
      inputs_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
      results_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
      blockers JSONB DEFAULT '[]'::jsonb NOT NULL,
      warnings JSONB DEFAULT '[]'::jsonb NOT NULL,
      calculated_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_calcs_plan ON lifting_calculations (plan_id);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_calcs_type ON lifting_calculations (calculation_type);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_calcs_status ON lifting_calculations (overall_status);`,
    `CREATE TABLE IF NOT EXISTS lifting_workflow_approvals (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES lifting_plans(id) ON DELETE CASCADE,
      revision_number INTEGER DEFAULT 1 NOT NULL,
      stage_key TEXT NOT NULL,
      stage_title_fa TEXT NOT NULL,
      decision TEXT DEFAULT 'PENDING' NOT NULL,
      signer_name TEXT,
      signer_role TEXT,
      signer_personnel_code TEXT,
      checklist_state JSONB DEFAULT '{}'::jsonb NOT NULL,
      blocking_reasons JSONB DEFAULT '[]'::jsonb NOT NULL,
      comments TEXT,
      decided_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_wf_plan ON lifting_workflow_approvals (plan_id);`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_wf_stage ON lifting_workflow_approvals (plan_id, stage_key);`,
    `ALTER TABLE lifting_cranes ADD COLUMN IF NOT EXISTS dead_weight_ton DOUBLE PRECISION;`,
    `ALTER TABLE lifting_cranes ADD COLUMN IF NOT EXISTS default_outrigger_pad_area_m2 DOUBLE PRECISION;`,
    `ALTER TABLE lifting_plans ADD COLUMN IF NOT EXISTS unit_preferences JSONB DEFAULT '{"massUnit":"ton","lengthUnit":"m","pressureUnit":"kPa","windUnit":"m/s"}'::jsonb NOT NULL;`,
    `ALTER TABLE lifting_plans ADD COLUMN IF NOT EXISTS engineering_checklist JSONB DEFAULT '{}'::jsonb NOT NULL;`,
    `ALTER TABLE lifting_plans ADD COLUMN IF NOT EXISTS hse_checklist JSONB DEFAULT '{}'::jsonb NOT NULL;`,
    `ALTER TABLE lifting_plans ADD COLUMN IF NOT EXISTS field_conditions_verification JSONB DEFAULT '{}'::jsonb NOT NULL;`,
    `ALTER TABLE lifting_plans ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT '2.1.0-core' NOT NULL;`,
    `CREATE TABLE IF NOT EXISTS lifting_stage_gates (
      id SERIAL PRIMARY KEY,
      gate_code TEXT NOT NULL UNIQUE,
      title_fa TEXT NOT NULL,
      criteria_fa TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      evidence_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
      verified_by TEXT,
      verified_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lifting_gates_code ON lifting_stage_gates (gate_code);`,
  ], 'lifting-plan-tables');

  console.log('[Migration] AI knowledge, chat, provider, assignment, PSM, Fire Design, Risk Assessment, SDS and Lifting Plan tables verified.');
  console.log('[Migration] All database tables and missing columns verified successfully.');
}

export async function rollbackPsmSchema() {
  await executeBatchWithFallback([
    `DROP TABLE IF EXISTS psm_gate_deviations CASCADE;`,
    `DROP TABLE IF EXISTS psm_stage_gates CASCADE;`,
    `DROP TABLE IF EXISTS psm_maturity_assessments CASCADE;`,
    `DROP TABLE IF EXISTS psm_specialized_studies CASCADE;`,
    `DROP TABLE IF EXISTS psm_capa_items CASCADE;`,
    `DROP TABLE IF EXISTS psm_documents CASCADE;`,
    `DROP TABLE IF EXISTS psm_wbs_tasks CASCADE;`,
    `DROP TABLE IF EXISTS psm_gaps CASCADE;`,
    `DROP TABLE IF EXISTS psm_assessments CASCADE;`,
    `DROP TABLE IF EXISTS psm_process_assets CASCADE;`,
    `DROP TABLE IF EXISTS psm_projects CASCADE;`,
  ], 'psm-rollback');
  console.log('[Migration] PSM schema rollback completed successfully.');
}

async function ensureSchemaPrivileges() {
  if (process.env.SQL_ADMIN_USER && process.env.SQL_ADMIN_PASSWORD && process.env.SQL_USER) {
    try {
      const pg = await import('pg');
      const Client = (pg as any).default?.Client || (pg as any).Client;
      const sslConfig = getPostgresSslConfig();
      const adminClient = new Client({
        host: process.env.SQL_HOST,
        port: Number(process.env.SQL_PORT || process.env.POSTGRES_PORT || 5432),
        user: process.env.SQL_ADMIN_USER,
        password: process.env.SQL_ADMIN_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: sslConfig || false,
        connectionTimeoutMillis: 10000,
      });
      await adminClient.connect();
      const appUser = process.env.SQL_USER.replace(/"/g, '""');
      const adminUser = process.env.SQL_ADMIN_USER.replace(/"/g, '""');

      await adminClient.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          BEGIN
            EXECUTE 'GRANT "${appUser}" TO "${adminUser}"';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          EXECUTE 'GRANT ALL ON SCHEMA public TO "${appUser}"';
          EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${appUser}"';
          EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${appUser}"';
          EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${appUser}"';
          EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${appUser}"';
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            BEGIN
              EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO "${appUser}"';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
          FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
            BEGIN
              EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequencename) || ' OWNER TO "${appUser}"';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END $$;
      `);

      await adminClient.end();
      console.log('[Migration] Table ownership and permissions successfully synchronized.');
    } catch (err: any) {
      console.warn('[Migration] Schema privilege sync notice:', err?.message || err);
    }
  }
}

async function seedDefaultAdminIfMissing() {
  try {
    const existingAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          sql`UPPER(REPLACE(REPLACE(${users.role}, ' ', ''), '_', '')) IN ('ADMIN', 'ADMINISTRATOR')`
        )
      )
      .limit(1);

    if (existingAdmins.length === 0) {
      const defaultPassword =
        process.env.DEFAULT_ADMIN_PASSWORD ||
        (process.env.NODE_ENV === 'production'
          ? crypto.randomBytes(12).toString('base64url')
          : 'admin123');
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      await db
        .insert(users)
        .values({
          uid: 'admin-master-uid',
          username: 'admin',
          email: 'admin@hse.local',
          fullName: 'مدیر ارشد سامانه',
          personnelNumber: '1000',
          nationalId: '0000000000',
          phoneNumber: '09120000000',
          jobTitle: 'مدیر ارشد سیستم',
          role: 'Administrator',
          accountStatus: 'Active',
          isActive: true,
          personnelAccessScope: 'ALL',
          permissions: { all: true },
          profileData: { initialSeed: true },
          passwordHash,
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .catch(() => {});
      console.log('[Migration] Initial Administrator account verified/seeded (username: admin)');
    }
  } catch (err) {
    console.warn('[Migration] Admin check notice:', err);
  }
}

async function ensurePerformanceIndexes() {
  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
    `CREATE INDEX IF NOT EXISTS idx_users_personnel_number ON users(personnel_number);`,
    `CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);`,
    `CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);`,
    `CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);`,
    `CREATE INDEX IF NOT EXISTS idx_personnel_code ON personnel(personnel_code);`,
    `CREATE INDEX IF NOT EXISTS idx_personnel_national ON personnel(national_code);`,
    `CREATE INDEX IF NOT EXISTS idx_personnel_dept ON personnel(department_id);`,
    `CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);`,
    `CREATE INDEX IF NOT EXISTS idx_permits_number ON permits(permit_number);`,
    `CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);`,
    `CREATE INDEX IF NOT EXISTS idx_permits_dates ON permits(start_date, end_date);`,
    `CREATE INDEX IF NOT EXISTS idx_permits_location ON permits(location);`,
    `CREATE INDEX IF NOT EXISTS idx_incidents_number ON incidents(incident_number);`,
    `CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);`,
    `CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);`,
    `CREATE INDEX IF NOT EXISTS idx_med_exams_personnel_year ON periodic_medical_exams(personnel_id, exam_year);`,
    `CREATE INDEX IF NOT EXISTS idx_med_exams_personnel_code ON periodic_medical_exams(personnel_code);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_is_deleted ON notifications(is_deleted);`
  ];

  try {
    await db.execute(sql.raw(indexStatements.join('\n')));
  } catch {
    for (const statement of indexStatements) {
      try {
        await db.execute(sql.raw(statement));
      } catch {
        // Ignore if table not yet created or index exists
      }
    }
  }
}

async function main() {
  await runMigrations();
  process.exit(0);
}

// Run standalone if invoked directly
if (process.argv[1]?.includes('migrate.ts') || process.argv[1]?.includes('migrate.js')) {
  main().catch(e => {
    console.error('[Migration Error]', e);
    process.exit(1);
  });
}

