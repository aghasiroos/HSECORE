import { GoogleGenAI } from '@google/genai';
import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';
import { localAIProvider, OllamaHealthStatus, OllamaModelInfo } from './ai.local-provider.ts';
import { bootstrapAIProviders, aiProviderRegistry } from './provider/index.ts';

// Register default Ollama provider once (idempotent)
bootstrapAIProviders();

let aiClient: GoogleGenAI | null = null;
let cachedApiKey: string = '';
let cloudApiUnavailable = false;

function getAIClient(): GoogleGenAI | null {
  if (!config.aiEngine.allowCloudFallback) return null;
  const apiKey = (process.env.GEMINI_API_KEY || config.geminiApiKey || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'YOUR_API_KEY') {
    return null;
  }
  if (apiKey !== cachedApiKey) {
    cachedApiKey = apiKey;
    cloudApiUnavailable = false;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  if (cloudApiUnavailable) {
    return null;
  }
  return aiClient;
}

function handleCloudError(err: any) {
  const msg = String(err?.message || err || '');
  if (
    msg.includes('401') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    msg.includes('403') ||
    msg.includes('PERMISSION_DENIED')
  ) {
    cloudApiUnavailable = true;
  }
  logger.debug('[AIService] Cloud Gemini unavailable, using built-in HSECORE Expert Engine', {
    reason: msg.slice(0, 160),
  });
}

export class AIService {
  /**
   * Check if any AI provider is available (Local Ollama, Cloud Gemini, or Built-in HSECORE Expert Engine)
   */
  isConfigured(): boolean {
    // This indicates that the local provider is enabled, not that a model is installed.
    return config.aiEngine.enabled;
  }

  /**
   * Health and status inspection of the AI engine
   */
  async getStatus(): Promise<OllamaHealthStatus> {
    // Preserve the real Ollama health result. The built-in deterministic fallback
    // is not an inference engine and must not make the local engine look healthy.
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
   * Grounded Chat Generation via Cloud Gemini ('gemini-3.8-flash')
   * Used by AIOrchestrator when Local Ollama is unreachable
   */
  async generateGroundedChatResponse(
    systemInstruction: string,
    message: string,
    history?: Array<{ role: string; content: string }>
  ): Promise<{ text: string; model: string } | null> {
    if (!config.aiEngine.allowCloudFallback) return null;
    const ai = getAIClient();
    if (!ai) return null;

    try {
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      if (Array.isArray(history)) {
        for (const h of history.slice(-6)) {
          if (h.content && h.content.trim()) {
            contents.push({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.content }],
            });
          }
        }
      }
      // Avoid duplicating the current user message if already at the end of history
      const lastItem = contents[contents.length - 1];
      if (!lastItem || lastItem.role !== 'user' || lastItem.parts[0]?.text !== message) {
        contents.push({ role: 'user', parts: [{ text: message }] });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
        },
      });

      const text = response.text?.trim();
      if (text) {
        return { text, model: 'gemini-3.8-flash' };
      }
    } catch (cloudErr: any) {
      handleCloudError(cloudErr);
    }
    return null;
  }

  /**
   * Primary Chat Generation
   * Prefers local offline LLM container; falls back to cloud or built-in expert engine
   */
  async generateChatResponse(message: string, history?: Array<{ role: string; content: string }>): Promise<string> {
    const systemInstruction = `شما یک دستیار ارشد هوشمند، متخصص و مشاور بهداشت، ایمنی و محیط زیست (HSE) در سامانه جامع سازمانی HSECORE هستید.
پاسخ‌های شما باید دقیق، علمی، مستند به استانداردهای بین‌المللی (OSHA, ISO 45001, ISO 14001) و مقررات ملی بهداشت حرفه‌ای و طب کار ایران باشد.
از زبان فارسی سلیس، رسمی، شایسته و حرفه‌ای استفاده کنید.`;

    // 1. Try Local AI Engine (Ollama container) first
    if (config.aiEngine.enabled) {
      try {
        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
          { role: 'system', content: systemInstruction },
        ];

        if (Array.isArray(history)) {
          for (const h of history) {
            if (h.content && (h.role === 'user' || h.role === 'assistant')) {
              messages.push({ role: h.role, content: h.content });
            }
          }
        }

        messages.push({ role: 'user', content: message });

        const result = await localAIProvider.chat(messages, {
          temperature: 0.3,
          max_tokens: 1200,
        });

        if (result.text) {
          return result.text;
        }
      } catch (localErr: any) {
        logger.debug('[AIService] Local AI chat execution skipped, using fallback', { error: localErr.message });
      }
    }

    // 2. Cloud fallback is disabled by default; enable only with explicit approval.
    if (config.aiEngine.allowCloudFallback) {
      const cloudRes = await this.generateGroundedChatResponse(systemInstruction, message, history);
      if (cloudRes?.text) return cloudRes.text;
    }

    // 3. Built-in HSE Expert response
    return `📌 **پاسخ تخصصی دستیار هوشمند HSECORE**\n\nدر پاسخ به پرسش شما («${message}»):\nبر اساس استانداردهای مدیریت ایمنی، بهداشت حرفه‌ای و محیط زیست (ISO 45001 / ISO 14001 / OSHA)، رعایت سلسله‌مراتب کنترل ریسک، صدور پروانه کار معتبر پیش از عملیات، پایش مستمر شاخص‌های سلامت شغلی و ثبت و ریشه‌یابی تمامی رویدادها و شبه‌حوادث الزامی است. برای دریافت آمار لحظه‌ای هر بخش، می‌توانید از دستیار تخصصی همان ماژول استفاده فرمایید.`;
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

    // 1. Try Local AI Engine
    if (config.aiEngine.enabled) {
      try {
        const result = await localAIProvider.generate(prompt, {
          temperature: 0.2,
          max_tokens: 1500,
        });
        const cleanJson = result.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleanJson);
      } catch (err: any) {
        logger.debug('[AIService] Local BPMN generation skipped, falling back', { error: err.message });
      }
    }

    // 2. Cloud generation is opt-in to keep HSECORE organizational data local.
    const ai = config.aiEngine.allowCloudFallback ? getAIClient() : null;
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });
        const text = response.text || '';
        const cleanJson = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleanJson);
      } catch (err) {
        handleCloudError(err);
      }
    }

    // 3. High-quality deterministic fallback BPMN
    return {
      name: `فرآیند ${category}: ${description.slice(0, 30)}`,
      category,
      priority,
      xml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="true"><bpmn:startEvent id="StartEvent_1" name="شروع فرآیند"/><bpmn:userTask id="Task_1" name="بررسی و اقدام اولیه"/><bpmn:userTask id="Task_2" name="تایید سرپرست HSE"/><bpmn:endEvent id="EndEvent_1" name="پایان فرآیند"/></bpmn:process></bpmn:definitions>`,
      tasks: [
        { id: 'Task_1', name: 'بررسی و اقدام اولیه', assignee: 'HSE_OFFICER' },
        { id: 'Task_2', name: 'تایید سرپرست HSE', assignee: 'HSE_MANAGER' },
      ],
    };
  }
}

export const aiService = new AIService();
