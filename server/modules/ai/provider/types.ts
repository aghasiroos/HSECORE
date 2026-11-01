/**
 * HSECORE AI Provider contract (engine-agnostic).
 * Phase 3a: interface + Ollama adapter only. Additional engines register later
 * without changing AI Core / Orchestrator call sites.
 */

export type AIProviderKind = 'ollama' | 'lmstudio' | 'openai_compatible' | 'custom';

export type AIProviderCapability =
  | 'health'
  | 'listModels'
  | 'listInstalled'
  | 'pull'
  | 'delete'
  | 'load'
  | 'unload'
  | 'generate'
  | 'chat'
  | 'embeddings'
  | 'runningModels'
  | 'resourceUsage'
  | 'installEngine'
  | 'manageEngine';

export class UnsupportedCapabilityError extends Error {
  readonly code = 'UNSUPPORTED_CAPABILITY';
  constructor(
    public readonly providerId: string,
    public readonly capability: AIProviderCapability
  ) {
    super(`Provider "${providerId}" does not support capability "${capability}"`);
    this.name = 'UnsupportedCapabilityError';
  }
}

export interface AIProviderInfo {
  id: string;
  kind: AIProviderKind;
  name: string;
  nameFa: string;
  version?: string;
  capabilities: AIProviderCapability[];
  isDefault?: boolean;
}

export interface AIProviderHealth {
  isAvailable: boolean;
  providerId: string;
  latencyMs?: number;
  version?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AIInstalledModel {
  id: string;
  name: string;
  sizeBytes?: number;
  digest?: string;
  details?: Record<string, unknown>;
  modifiedAt?: string;
}

export interface AIChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderChatRequest {
  model?: string;
  messages: AIChatMessageInput[];
  system?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AIProviderChatResponse {
  text: string;
  model: string;
  providerId: string;
  durationMs?: number;
  raw?: unknown;
}

export interface AIProviderEmbedRequest {
  model?: string;
  input: string | string[];
  timeoutMs?: number;
}

export interface AIProviderEmbedResponse {
  embeddings: number[][];
  model: string;
  providerId: string;
}

/** Standard provider surface — optional methods may throw UnsupportedCapabilityError */
export interface AIProvider {
  readonly id: string;
  readonly kind: AIProviderKind;
  getProviderInfo(): AIProviderInfo;
  supports(capability: AIProviderCapability): boolean;
  checkHealth(): Promise<AIProviderHealth>;
  listInstalledModels(): Promise<AIInstalledModel[]>;
  listModels?(query?: string): Promise<AIInstalledModel[]>;
  pullModel?(modelRef: string): Promise<{ success: boolean; message: string }>;
  deleteModel?(modelRef: string): Promise<{ success: boolean; message: string }>;
  loadModel?(modelRef: string): Promise<void>;
  unloadModel?(modelRef: string): Promise<void>;
  chat(req: AIProviderChatRequest): Promise<AIProviderChatResponse>;
  generate?(prompt: string, opts?: { model?: string; system?: string; timeoutMs?: number }): Promise<AIProviderChatResponse>;
  embeddings?(req: AIProviderEmbedRequest): Promise<AIProviderEmbedResponse>;
  getRunningModels?(): Promise<AIInstalledModel[]>;
  getResourceUsage?(): Promise<Record<string, unknown>>;
}
