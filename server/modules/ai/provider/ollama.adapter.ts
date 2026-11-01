/**
 * Ollama AIProvider adapter — delegates to existing LocalAIProvider implementation.
 * Keeps runtime behavior identical while exposing the standard provider contract.
 */

import { localAIProvider } from '../ai.local-provider.ts';
import { config } from '../../../core/config.ts';
import type {
  AIInstalledModel,
  AIProvider,
  AIProviderCapability,
  AIProviderChatRequest,
  AIProviderChatResponse,
  AIProviderEmbedRequest,
  AIProviderEmbedResponse,
  AIProviderHealth,
  AIProviderInfo,
} from './types.ts';
import { UnsupportedCapabilityError } from './types.ts';

const OLLAMA_CAPABILITIES: AIProviderCapability[] = [
  'health',
  'listInstalled',
  'pull',
  'delete',
  'chat',
  'generate',
  'embeddings',
];

export class OllamaProviderAdapter implements AIProvider {
  readonly id = 'ollama';
  readonly kind = 'ollama' as const;

  getProviderInfo(): AIProviderInfo {
    return {
      id: this.id,
      kind: this.kind,
      name: 'Ollama',
      nameFa: 'موتور محلی Ollama',
      capabilities: [...OLLAMA_CAPABILITIES],
      isDefault: true,
    };
  }

  supports(capability: AIProviderCapability): boolean {
    return OLLAMA_CAPABILITIES.includes(capability);
  }

  private ensure(capability: AIProviderCapability): void {
    if (!this.supports(capability)) {
      throw new UnsupportedCapabilityError(this.id, capability);
    }
  }

  async checkHealth(): Promise<AIProviderHealth> {
    const status = await localAIProvider.checkHealth();
    return {
      isAvailable: Boolean(status.isAvailable && status.localInferenceReady),
      providerId: this.id,
      latencyMs: status.latencyMs,
      version: status.version,
      message: status.error,
      details: {
        engineUrl: status.engineUrl,
        installedModels: status.installedModels?.length ?? 0,
        chatModelInstalled: status.chatModelInstalled,
        embeddingModelInstalled: status.embeddingModelInstalled,
        activeRequests: status.activeRequests,
        queuedRequests: status.queuedRequests,
        defaultChatModel: status.defaultChatModel,
        defaultEmbedModel: status.defaultEmbedModel,
        raw: status,
      },
    };
  }

  async listInstalledModels(): Promise<AIInstalledModel[]> {
    const models = await localAIProvider.listInstalledModels();
    return models.map((m) => ({
      id: m.name || m.model,
      name: m.name || m.model,
      sizeBytes: m.size,
      digest: m.digest,
      details: m.details as Record<string, unknown> | undefined,
      modifiedAt: m.modified_at,
    }));
  }

  async pullModel(modelRef: string): Promise<{ success: boolean; message: string }> {
    this.ensure('pull');
    return localAIProvider.pullModel(modelRef);
  }

  async deleteModel(modelRef: string): Promise<{ success: boolean; message: string }> {
    this.ensure('delete');
    return localAIProvider.deleteModel(modelRef);
  }

  async chat(req: AIProviderChatRequest): Promise<AIProviderChatResponse> {
    this.ensure('chat');
    const model = req.model || config.aiEngine.defaultChatModel;
    const messages = [...req.messages];
    if (req.system && !messages.some((m) => m.role === 'system')) {
      messages.unshift({ role: 'system', content: req.system });
    }
    const result = await localAIProvider.chat(messages, {
      model,
      temperature: req.temperature,
      top_p: req.topP,
      max_tokens: req.maxTokens,
      timeoutMs: req.timeoutMs,
    });
    return {
      text: result.text,
      model: result.model || model,
      providerId: this.id,
      durationMs: result.durationMs,
      raw: result,
    };
  }

  async generate(
    prompt: string,
    opts?: { model?: string; system?: string; timeoutMs?: number }
  ): Promise<AIProviderChatResponse> {
    this.ensure('generate');
    const model = opts?.model || config.aiEngine.defaultChatModel;
    const result = await localAIProvider.generate(prompt, {
      model,
      system: opts?.system,
      timeoutMs: opts?.timeoutMs,
    });
    return {
      text: result.text,
      model: result.model || model,
      providerId: this.id,
      durationMs: result.durationMs,
      raw: result,
    };
  }

  async embeddings(req: AIProviderEmbedRequest): Promise<AIProviderEmbedResponse> {
    this.ensure('embeddings');
    const model = req.model || config.aiEngine.defaultEmbedModel;
    const inputs = Array.isArray(req.input) ? req.input : [req.input];
    const embeddings: number[][] = [];
    for (const item of inputs) {
      const result = await localAIProvider.generateEmbedding(item, model);
      embeddings.push(result.embedding || []);
    }
    return { embeddings, model, providerId: this.id };
  }
}

export const ollamaProviderAdapter = new OllamaProviderAdapter();
