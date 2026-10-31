import { Request, Response } from 'express';
import { aiService } from './ai.service.ts';
import { aiOrchestrator } from './ai.orchestrator.ts';
import { aiRequestQueue } from './ai.queue.ts';
import { aiAuditService } from './ai.audit.ts';
import { aiRagService } from './ai.rag.service.ts';
import { checkUserHasPermission, type UserContext } from '../../core/middleware/auth.ts';

export class AIController {
  async getStatus(_req: Request, res: Response) {
    try {
      const engineStatus = await aiService.getStatus();
      return res.json({
        success: true,
        data: {
          ...engineStatus,
          queue: aiRequestQueue.telemetry,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت وضعیت موتور هوش مصنوعی' });
    }
  }

  async listAssistants(req: Request, res: Response) {
    try {
      const assistants = aiOrchestrator.listAssistants(req.user);
      return res.json({ success: true, data: assistants });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت فهرست دستیاران' });
    }
  }

  async listModels(_req: Request, res: Response) {
    try {
      const models = await aiService.listInstalledModels();
      return res.json({ success: true, data: models });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت فهرست مدل‌ها' });
    }
  }

  async pullModel(req: Request, res: Response) {
    const { modelName } = req.body;
    if (!modelName || typeof modelName !== 'string') {
      return res.status(400).json({ success: false, message: 'نام مدل الزامی است.' });
    }

    try {
      const result = await aiService.pullModel(modelName);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در شروع بارگیری مدل' });
    }
  }

  async deleteModel(req: Request, res: Response) {
    const modelName = req.params.name;
    if (!modelName) {
      return res.status(400).json({ success: false, message: 'نام مدل مشخص نشده است.' });
    }

    try {
      const result = await aiService.deleteModel(modelName);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در حذف مدل' });
    }
  }

  async chat(req: Request, res: Response) {
    const { message, assistantId, history, contextModule, allowTools } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'پیام کاربر الزامی است.' });
    }

    try {
      const userContext = req.user
        ? {
            id: req.user.id,
            uid: req.user.uid,
            name: req.user.name || req.user.username,
            role: req.user.role,
            permissions: req.user.permissions,
            personnelCode: req.user.personnelCode,
            department: req.user.department,
          }
        : undefined;

      const response = await aiOrchestrator.processChat(
        {
          message,
          assistantId,
          history,
          contextModule,
          allowTools,
        },
        userContext
      );

      return res.json(response);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'خطا در پردازش هوش مصنوعی' });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 50;
      const logs = aiAuditService.getRecentLogs(limit);
      const analytics = aiAuditService.getAnalyticsSummary();
      return res.json({ success: true, data: { logs, analytics } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت لاگ‌های هوش مصنوعی' });
    }
  }

  private getAllowedKnowledgeCategories(user?: UserContext): string[] {
    if (!user) return [];
    const categories = ['GENERAL'];
    if (checkUserHasPermission(user, 'ptw:read')) categories.push('PTW');
    if (checkUserHasPermission(user, 'health:read')) categories.push('HEALTH');
    if (checkUserHasPermission(user, 'safety:read')) categories.push('SAFETY');
    if (checkUserHasPermission(user, 'environment:read')) categories.push('ENVIRONMENT');
    return categories;
  }

  async listKnowledgeDocs(req: Request, res: Response) {
    try {
      const docs = await aiRagService.listDocuments(this.getAllowedKnowledgeCategories(req.user));
      return res.json({ success: true, data: docs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت فهرست اسناد پایگاه دانش' });
    }
  }

  async createKnowledgeDoc(req: Request, res: Response) {
    const { title, content, docType, category, summary } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'عنوان و متن سند الزامی هستند.' });
    }

    try {
      const result = await aiRagService.indexDocument({
        title,
        content,
        docType,
        category,
        summary,
        uploadedBy: (req as any).user?.username || (req as any).user?.name || 'system',
      });
      return res.json({ success: true, data: result, message: 'سند با موفقیت نمایه و ذخیره شد.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در نمایه‌سازی سند' });
    }
  }

  async deleteKnowledgeDoc(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'شناسه سند نامعتبر است.' });
    }

    try {
      await aiRagService.deleteDocument(id);
      return res.json({ success: true, message: 'سند با موفقیت حذف گردید.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در حذف سند' });
    }
  }

  async queryKnowledge(req: Request, res: Response) {
    const { query, category, topK } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'عبارت جستجو الزامی است.' });
    }

    try {
      const allowedCategories = this.getAllowedKnowledgeCategories(req.user);
      if (category && category !== 'ALL' && !allowedCategories.includes(String(category))) {
        return res.status(403).json({ success: false, message: 'دسترسی به این دسته از اسناد مجاز نیست.' });
      }
      const requestedTopK = topK ? Number(topK) : 4;
      const results = await aiRagService.queryRelevantChunks(query, {
        category, topK: Number.isFinite(requestedTopK) ? Math.min(Math.max(requestedTopK, 1), 10) : 4,
        allowedCategories,
      });
      return res.json({ success: true, data: results });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در جستجوی معنایی' });
    }
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

