import { config } from '../../core/config.ts';
import { localAIProvider, OllamaHealthStatus, OllamaModelInfo } from './ai.local-provider.ts';
import { bootstrapAIProviders, aiProviderRegistry } from './provider/index.ts';

// Register default Ollama provider once (idempotent)
bootstrapAIProviders();

export class AIService {
  /**
   * Check whether the local Ollama provider is enabled
   */
  isConfigured(): boolean {
    // This indicates that the local provider is enabled, not that a model is installed.
    return config.aiEngine.enabled;
  }

  /**
   * Health and status inspection of the AI engine
   */
  async getStatus(): Promise<OllamaHealthStatus> {
    // Report actual Ollama health; no synthetic fallback is treated as an AI engine.
    return localAIProvider.checkHealth();
  }

  /**
   * List installed models in the local engine
   */
  async listInstalledModels(): Promise<OllamaModelInfo[]> {
    return localAIProvider.listInstalledModels();
  }

  /**
   * Pull / Download a new model to the local engine
   */
  async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
    return localAIProvider.pullModel(modelName);
  }

  /**
   * Delete a model from the local engine
   */
  async deleteModel(modelName: string): Promise<{ success: boolean; message: string }> {
    return localAIProvider.deleteModel(modelName);
  }

  /**
   * Provider registry surface (Phase 3a — Ollama only; more engines later).
   */
  listProviders() {
    bootstrapAIProviders();
    return aiProviderRegistry.list();
  }

  getDefaultProviderId(): string | null {
    bootstrapAIProviders();
    return aiProviderRegistry.getDefaultId();
  }

  getProvider(providerId?: string) {
    bootstrapAIProviders();
    return aiProviderRegistry.get(providerId);
  }

  /**
   * Process & Workflow BPMN Generation
   */
  async generateBPMN(description: string, category: string = 'PTW', priority: string = 'متوسط'): Promise<any> {
    const prompt = `You are an expert BPMN 2.0 Architect specializing in HSE process engineering.
User wants an automated BPMN workflow generated based on this description: "${description}".
Category: ${category}, Priority: ${priority}.

Return ONLY valid JSON matching this schema:
{
  "name": "Process Title in Persian",
  "category": "${category}",
  "priority": "${priority}",
  "xml": "Valid BPMN 2.0 XML string",
  "tasks": [
    { "id": "Task_1", "name": "Task Name in Persian", "assignee": "ROLE" }
  ]
}`;

    if (!config.aiEngine.enabled) throw new Error('سرویس Ollama غیرفعال است.');
    const result = await localAIProvider.generate(prompt, { temperature: 0.2, max_tokens: 1500 });
    const cleanJson = result.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleanJson);
    } catch {
      throw new Error('مدل پاسخ BPMN معتبر تولید نکرد؛ هیچ پاسخ جایگزینی ساخته نشد.');
    }
  }
}

export const aiService = new AIService();
