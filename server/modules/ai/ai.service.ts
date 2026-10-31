import { GoogleGenAI } from '@google/genai';
import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';
import { localAIProvider, OllamaHealthStatus, OllamaModelInfo } from './ai.local-provider.ts';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && config.geminiApiKey) {
    aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return aiClient;
}

export class AIService {
  /**
   * Check if any AI provider is available (preferring local offline engine)
   */
  isConfigured(): boolean {
    return Boolean(config.aiEngine.enabled || config.geminiApiKey);
  }

  /**
   * Health and status inspection of the Local AI engine
   */
  async getStatus(): Promise<OllamaHealthStatus> {
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
   * Primary Chat Generation
   * Prefers local offline LLM container; falls back to cloud or offline message
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
        logger.warn('[AIService] Local AI chat execution failed, checking fallbacks', { error: localErr.message });
      }
    }

    // 2. Fallback to Cloud Gemini if configured by user
    const ai = getAIClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { role: 'user', parts: [{ text: `${systemInstruction}\n\nپرسش کاربر: ${message}` }] },
          ],
        });
        return response.text || 'پاسخی از مدل دریافت نشد.';
      } catch (cloudErr: any) {
        logger.error('[AIService] Cloud AI chat error', { error: cloudErr.message });
      }
    }

    // 3. Graceful offline notification
    return `سامانه HSECORE (موتور هوش مصنوعی محلی): موتور Local LLM در حال حاضر در دسترس نمی‌باشد یا در حال راه‌اندازی است. لطفاً وضعیت سرویس hse-ai-engine را در کانتینر بررسی فرمایید. پیام شما: "${message}"`;
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
        logger.warn('[AIService] Local BPMN generation failed, falling back', { error: err.message });
      }
    }

    // 2. Try Cloud AI if configured
    const ai = getAIClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const text = response.text || '';
        const cleanJson = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleanJson);
      } catch (err) {
        logger.error('[AIService] Cloud Gemini BPMN generation error', err);
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
