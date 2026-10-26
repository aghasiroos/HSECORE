import { Request, Response } from 'express';
import { aiService } from './ai.service.ts';
import { ApiResponse } from '../../core/response.ts';

export class AIController {
  async chat(req: Request, res: Response) {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'پیام کاربر الزامی است.' });
    }
    const reply = await aiService.generateChatResponse(message, history);
    return res.json({ success: true, reply });
  }

  async generateBPMN(req: Request, res: Response) {
    const { description, category, priority } = req.body;
    if (!description) {
      return res.status(400).json({ success: false, message: 'توضیحات فرآیند الزامی است.' });
    }
    const generated = await aiService.generateBPMN(description, category, priority);
    return res.json({ success: true, data: generated });
  }
}

export const aiController = new AIController();
