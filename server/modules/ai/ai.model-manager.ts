/**
 * AI Model Manager — resolves per-service model assignments from DB
 * with safe fallbacks to environment defaults (Phase 3b).
 */

import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';
import { bootstrapAIProviders, aiProviderRegistry } from './provider/index.ts';

export interface ResolvedModelAssignment {
  serviceKey: string;
  providerId: string;
  modelRef: string;
  fallbackProviderId?: string | null;
  fallbackModelRef?: string | null;
  contextLimit?: number | null;
  enabled: boolean;
  source: 'database' | 'env_default';
}

export interface AssignmentInput {
  serviceKey: string;
  providerId?: string | null;
  modelRef?: string | null;
  fallbackProviderId?: string | null;
  fallbackModelRef?: string | null;
  contextLimit?: number | null;
  enabled?: boolean;
}

const DEFAULT_SERVICE_KEYS = [
  'GENERAL_HSE',
  'PTW_SHERPA',
  'INCIDENT_ANALYSIS',
  'RISK_ASSESSMENT',
  'OCCUPATIONAL_HEALTH',
  'NUTRITION_LIFESTYLE',
  'ENVIRONMENT_WASTE',
  'INSPECTION_5S',
  'TRAINING_COMPLIANCE',
  'MANAGEMENT_ANALYTICS',
  'RAG_EMBEDDINGS',
] as const;

export class AIModelManager {
  private envDefault(serviceKey: string): ResolvedModelAssignment {
    const isEmbed = serviceKey === 'RAG_EMBEDDINGS';
    return {
      serviceKey,
      providerId: 'ollama',
      modelRef: isEmbed ? config.aiEngine.defaultEmbedModel : config.aiEngine.defaultChatModel,
      fallbackProviderId: null,
      fallbackModelRef: null,
      contextLimit: config.aiEngine.contextTokens,
      enabled: true,
      source: 'env_default',
    };
  }

  async listAssignments(): Promise<ResolvedModelAssignment[]> {
    try {
      const rows = await db
        .select()
        .from(schema.aiModelAssignments)
        .orderBy(schema.aiModelAssignments.serviceKey);

      const byKey = new Map<string, ResolvedModelAssignment>();
      for (const row of rows) {
        byKey.set(row.serviceKey, {
          serviceKey: row.serviceKey,
          providerId: row.providerId || 'ollama',
          modelRef: row.modelRef || config.aiEngine.defaultChatModel,
          fallbackProviderId: row.fallbackProviderId,
          fallbackModelRef: row.fallbackModelRef,
          contextLimit: row.contextLimit,
          enabled: row.enabled !== false,
          source: 'database',
        });
      }

      // Ensure known services always appear (env fallback when no DB row)
      const result: ResolvedModelAssignment[] = [];
      for (const key of DEFAULT_SERVICE_KEYS) {
        result.push(byKey.get(key) || this.envDefault(key));
        byKey.delete(key);
      }
      for (const extra of byKey.values()) {
        result.push(extra);
      }
      return result;
    } catch (err: any) {
      logger.warn('AIModelManager.listAssignments failed; using env defaults', {
        error: err?.message,
      });
      return DEFAULT_SERVICE_KEYS.map((k) => this.envDefault(k));
    }
  }

  async resolveForService(serviceKey: string): Promise<ResolvedModelAssignment> {
    const key = (serviceKey || 'GENERAL_HSE').trim() || 'GENERAL_HSE';
    try {
      const rows = await db
        .select()
        .from(schema.aiModelAssignments)
        .where(eq(schema.aiModelAssignments.serviceKey, key))
        .limit(1);
      if (rows.length && rows[0].enabled !== false) {
        const row = rows[0];
        return {
          serviceKey: key,
          providerId: row.providerId || 'ollama',
          modelRef: row.modelRef || config.aiEngine.defaultChatModel,
          fallbackProviderId: row.fallbackProviderId,
          fallbackModelRef: row.fallbackModelRef,
          contextLimit: row.contextLimit,
          enabled: true,
          source: 'database',
        };
      }
    } catch (err: any) {
      logger.warn('AIModelManager.resolveForService DB error', { serviceKey: key, error: err?.message });
    }
    return this.envDefault(key);
  }

  async upsertAssignment(input: AssignmentInput): Promise<ResolvedModelAssignment> {
    const serviceKey = (input.serviceKey || '').trim();
    if (!serviceKey || serviceKey.length > 64) {
      throw new Error('serviceKey نامعتبر است.');
    }
    const providerId = (input.providerId || 'ollama').trim();
    const modelRef = (input.modelRef || config.aiEngine.defaultChatModel).trim();
    if (!modelRef || modelRef.length > 160) {
      throw new Error('modelRef نامعتبر است.');
    }

    const existing = await db
      .select({ id: schema.aiModelAssignments.id })
      .from(schema.aiModelAssignments)
      .where(eq(schema.aiModelAssignments.serviceKey, serviceKey))
      .limit(1);

    const now = new Date();
    if (existing.length) {
      await db
        .update(schema.aiModelAssignments)
        .set({
          providerId,
          modelRef,
          fallbackProviderId: input.fallbackProviderId ?? null,
          fallbackModelRef: input.fallbackModelRef ?? null,
          contextLimit: input.contextLimit ?? null,
          enabled: input.enabled !== false,
          updatedAt: now,
        })
        .where(eq(schema.aiModelAssignments.id, existing[0].id));
    } else {
      await db.insert(schema.aiModelAssignments).values({
        serviceKey,
        providerId,
        modelRef,
        fallbackProviderId: input.fallbackProviderId ?? null,
        fallbackModelRef: input.fallbackModelRef ?? null,
        contextLimit: input.contextLimit ?? null,
        enabled: input.enabled !== false,
        metadata: {},
        updatedAt: now,
      });
    }

    return this.resolveForService(serviceKey);
  }

  async listProvidersFromDb(): Promise<any[]> {
    try {
      const rows = await db.select().from(schema.aiProviders).orderBy(schema.aiProviders.id);
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        nameFa: r.nameFa,
        enabled: r.enabled,
        isDefault: r.isDefault,
        baseUrl: r.baseUrl,
        capabilities: r.capabilities,
        metadata: r.metadata,
        source: 'database',
      }));
    } catch (err: any) {
      logger.warn('listProvidersFromDb failed', { error: err?.message });
      bootstrapAIProviders();
      return aiProviderRegistry.list().map((p) => ({ ...p, source: 'runtime' }));
    }
  }

  async getSetting(key: string): Promise<string | null> {
    try {
      const rows = await db
        .select()
        .from(schema.aiServiceSettings)
        .where(eq(schema.aiServiceSettings.settingKey, key))
        .limit(1);
      return rows[0]?.settingValue ?? null;
    } catch {
      return null;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    const settingKey = key.trim();
    if (!settingKey || settingKey.length > 128) throw new Error('setting key نامعتبر است.');
    const existing = await db
      .select({ id: schema.aiServiceSettings.id })
      .from(schema.aiServiceSettings)
      .where(eq(schema.aiServiceSettings.settingKey, settingKey))
      .limit(1);
    const now = new Date();
    if (existing.length) {
      await db
        .update(schema.aiServiceSettings)
        .set({ settingValue: value, updatedAt: now })
        .where(eq(schema.aiServiceSettings.id, existing[0].id));
    } else {
      await db.insert(schema.aiServiceSettings).values({
        settingKey,
        settingValue: value,
        updatedAt: now,
      });
    }
  }

  async getResourceSettings(): Promise<Record<string, string>> {
    const defaults: Record<string, string> = {
      max_concurrency: String(config.aiEngine.maxConcurrency || 1),
      request_timeout_ms: String(config.aiEngine.timeoutMs || 180000),
      context_tokens: String(config.aiEngine.contextTokens || 4096),
      default_chat_model: config.aiEngine.defaultChatModel,
      default_embed_model: config.aiEngine.defaultEmbedModel,
    };
    try {
      const rows = await db.select().from(schema.aiServiceSettings);
      for (const row of rows) {
        if (row.settingKey && row.settingValue != null) {
          defaults[row.settingKey] = row.settingValue;
        }
      }
    } catch {
      // keep env defaults
    }
    return defaults;
  }

  /** Sync installed models inventory snapshot from live provider into ai_models (best-effort). */
  async syncInstalledModelsFromProvider(providerId = 'ollama'): Promise<number> {
    bootstrapAIProviders();
    const provider = aiProviderRegistry.tryGet(providerId);
    if (!provider) return 0;
    const installed = await provider.listInstalledModels();
    let count = 0;
    for (const model of installed) {
      const ref = model.name || model.id;
      if (!ref) continue;
      try {
        const existing = await db
          .select({ id: schema.aiModels.id })
          .from(schema.aiModels)
          .where(eq(schema.aiModels.modelRef, ref))
          .limit(1);
        const now = new Date();
        if (existing.length) {
          await db
            .update(schema.aiModels)
            .set({
              status: 'installed',
              sizeBytes: model.sizeBytes ?? null,
              metadata: model.details || {},
              updatedAt: now,
            })
            .where(eq(schema.aiModels.id, existing[0].id));
        } else {
          await db.insert(schema.aiModels).values({
            providerId,
            modelRef: ref,
            displayName: ref,
            sizeBytes: model.sizeBytes ?? null,
            status: 'installed',
            metadata: model.details || {},
            updatedAt: now,
          });
        }
        count += 1;
      } catch (err: any) {
        logger.debug('sync model row failed', { ref, error: err?.message });
      }
    }
    return count;
  }
}

export const aiModelManager = new AIModelManager();
