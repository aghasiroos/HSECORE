/**
 * HSECORE Enterprise Local AI - Core Type Definitions
 */

export type AIAssistantId =
  | 'GENERAL_HSE'
  | 'PTW_SHERPA'
  | 'INCIDENT_ANALYSIS'
  | 'RISK_ASSESSMENT'
  | 'OCCUPATIONAL_HEALTH'
  | 'NUTRITION_LIFESTYLE'
  | 'ENVIRONMENT_WASTE'
  | 'INSPECTION_5S'
  | 'TRAINING_COMPLIANCE'
  | 'MANAGEMENT_ANALYTICS';

export interface AIAssistantMetadata {
  id: AIAssistantId;
  name: string;
  nameFa: string;
  title: string;
  description: string;
  systemPrompt: string;
  allowedRoles: string[];
  associatedModule: string;
  tools: string[];
  icon: string;
}

/** Module coverage entry for AI Module Registry */
export interface AIModuleCoverage {
  moduleId: string;
  moduleNameFa: string;
  connected: boolean;
  tools: string[];
  assistantIds: AIAssistantId[];
  notes?: string;
  parentModuleId?: string;
  level?: number;
  /** Internal tool-group alias; retained for backend routing but hidden from the user picker. */
  internal?: boolean;
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  citations?: string[];
  toolsUsed?: string[];
}

export interface AIChatRequest {
  message: string;
  assistantId?: AIAssistantId;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  contextModule?: string;
  /** Explicit module IDs selected from the server-provided AI coverage catalog. */
  selectedModules?: string[];
  contextTokens?: number;
  /** Internal-only cancellation signal supplied by the authenticated HTTP controller. */
  signal?: AbortSignal;
  allowTools?: boolean;
  model?: string;
}

export interface AIChatResponse {
  success: boolean;
  reply: string;
  assistantId: AIAssistantId;
  toolsUsed: string[];
  citations: string[];
  durationMs: number;
  model: string;
  queueWaitMs?: number;
}

export interface AIToolResult {
  toolName: string;
  titleFa: string;
  summary: string;
  data: any;
  timestamp: string;
}

export interface AIAuditRecord {
  userId?: number | string;
  userUid?: string;
  userName?: string;
  role?: string;
  assistantId: AIAssistantId;
  promptLength: number;
  responseLength: number;
  toolsUsed: string[];
  durationMs: number;
  model: string;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
}
