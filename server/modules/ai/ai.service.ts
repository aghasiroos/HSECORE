import { GoogleGenAI } from '@google/genai';
import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && config.geminiApiKey) {
    aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return aiClient;
}

export class AIService {
  isConfigured(): boolean {
    return Boolean(config.geminiApiKey);
  }

  async generateChatResponse(message: string, history?: Array<{ role: string; content: string }>): Promise<string> {
    const ai = getAIClient();
    if (!ai) {
      return `پاسخ آفلاین سامانه HSE: دستیار هوش مصنوعی در حال حاضر نیازمند پیکربندی کلید دسترسی GEMINI_API_KEY در تنظیمات سرور می‌باشد. پیام شما: "${message}"`;
    }

    try {
      const systemInstruction = `شما یک دستیار ارشد هوشمند، متخصص و مشاور بهداشت، ایمنی و محیط زیست (HSE) در صنایع نفت، گاز، پتروشیمی و تولیدی هستید.
پاسخ‌های شما باید دقیق، بر اساس استانداردهای OSHA، ISO 45001، ISO 14001 و قوانین ملی بهداشت حرفه‌ای ایران باشد.
از زبان فارسی سلیس، رسمی و حرفه‌ای استفاده کنید.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\nپرسش کاربر: ${message}` }] },
        ],
      });

      return response.text || 'پاسخی از مدل دریافت نشد.';
    } catch (error: any) {
      logger.error('Gemini chat error', error);
      return 'متاسفانه در برقراری ارتباط با سرویس هوش مصنوعی خطایی رخ داده است. لطفاً دقایقی دیگر تلاش فرمایید.';
    }
  }

  async generateBPMN(description: string, category: string = 'PTW', priority: string = 'متوسط'): Promise<any> {
    const ai = getAIClient();
    if (!ai) {
      // High-quality deterministic fallback BPMN
      return {
        name: `فرآیند ${category}: ${description.slice(0, 30)}`,
        category,
        priority,
        xml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="true"><bpmn:startEvent id="StartEvent_1" name="شروع فرآیند"/><bpmn:userTask id="Task_1" name="بررسی و اقدام اولیه"/><bpmn:userTask id="Task_2" name="تایید سرپرست HSE"/><bpmn:endEvent id="EndEvent_1" name="پایان فرآیند"/></bpmn:process></bpmn:definitions>`,
        tasks: [
          { id: 'Task_1', name: 'بررسی و اقدام اولیه', assignee: 'HSE_OFFICER' },
          { id: 'Task_2', name: 'تایید سرپرست HSE', assignee: 'HSE_MANAGER' },
        ],
      };
    }

    try {
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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      logger.error('Gemini BPMN generation error', error);
      // Fallback
      return {
        name: `فرآیند ${category}`,
        category,
        priority,
        xml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1"><bpmn:process id="Process_1" isExecutable="true"><bpmn:startEvent id="Start_1" name="شروع"/><bpmn:userTask id="Task_1" name="بررسی"/><bpmn:endEvent id="End_1" name="پایان"/></bpmn:process></bpmn:definitions>`,
        tasks: [{ id: 'Task_1', name: 'بررسی' }],
      };
    }
  }
}

export const aiService = new AIService();
