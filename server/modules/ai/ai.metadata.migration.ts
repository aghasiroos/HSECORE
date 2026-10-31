import { db, sql } from '../../core/db.ts';

export interface LegacyAIMetadataMigrationResult {
  skipped: boolean;
  migratedCount: number;
}

/**
 * Backfills only NULL metadata on legacy AI knowledge documents.
 * Empty objects preserve the existing category-permission model; explicit or
 * malformed non-NULL ACL metadata is never rewritten.
 */
export async function migrateLegacyAIKnowledgeMetadata(): Promise<LegacyAIMetadataMigrationResult> {
  return db.transaction(async (tx) => {
    const tableState = await tx.execute(sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND table_name = 'ai_knowledge_docs'
        ) AS table_exists,
        (
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'ai_knowledge_docs'
            AND column_name = 'metadata'
          LIMIT 1
        ) AS is_nullable,
        (
          SELECT column_default
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'ai_knowledge_docs'
            AND column_name = 'metadata'
          LIMIT 1
        ) AS column_default
    `);

    const state = (tableState as any).rows?.[0];
    if (!state?.table_exists || !state?.is_nullable) {
      return { skipped: true, migratedCount: 0 };
    }

    // Avoid scanning/locking the knowledge table again on every application start
    // once the NOT NULL constraint and '{}' default have already been installed.
    const hasEmptyObjectDefault =
      typeof state.column_default === 'string' && state.column_default.includes('{}');
    if (state.is_nullable === 'NO' && hasEmptyObjectDefault) {
      return { skipped: false, migratedCount: 0 };
    }

    let migratedCount = 0;
    if (state.is_nullable === 'YES') {
      const updateResult = await tx.execute(sql`
        UPDATE ai_knowledge_docs
        SET metadata = '{}'::jsonb
        WHERE metadata IS NULL
        RETURNING id
      `);
      migratedCount = ((updateResult as any).rows || []).length;
    }

    // Enforce the migrated invariant for future writes as well.
    if (!hasEmptyObjectDefault) {
      await tx.execute(sql`
        ALTER TABLE ai_knowledge_docs
        ALTER COLUMN metadata SET DEFAULT '{}'::jsonb
      `);
    }
    if (state.is_nullable === 'YES') {
      await tx.execute(sql`
        ALTER TABLE ai_knowledge_docs
        ALTER COLUMN metadata SET NOT NULL
      `);
    }

    return { skipped: false, migratedCount };
  });
}
