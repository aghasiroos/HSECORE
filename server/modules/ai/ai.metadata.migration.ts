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
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'ai_knowledge_docs'
            AND column_name = 'metadata'
        ) AS metadata_column_exists
    `);

    const state = (tableState as any).rows?.[0];
    if (!state?.table_exists || !state?.metadata_column_exists) {
      return { skipped: true, migratedCount: 0 };
    }

    const updateResult = await tx.execute(sql`
      UPDATE ai_knowledge_docs
      SET metadata = '{}'::jsonb
      WHERE metadata IS NULL
      RETURNING id
    `);

    // Enforce the migrated invariant for future writes as well.
    await tx.execute(sql`
      ALTER TABLE ai_knowledge_docs
      ALTER COLUMN metadata SET DEFAULT '{}'::jsonb
    `);
    await tx.execute(sql`
      ALTER TABLE ai_knowledge_docs
      ALTER COLUMN metadata SET NOT NULL
    `);

    return {
      skipped: false,
      migratedCount: ((updateResult as any).rows || []).length,
    };
  });
}
