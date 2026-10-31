import { Request, Response } from 'express';
import { aiService } from './ai.service.ts';
import { aiOrchestrator } from './ai.orchestrator.ts';
import { aiRequestQueue } from './ai.queue.ts';
import { aiAuditService, normalizeAILogLimit } from './ai.audit.ts';
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
      const limit = normalizeAILogLimit(req.query.limit);
      const logs = aiAuditService.getRecentLogs(limit);
      const analytics = aiAuditService.getAnalyticsSummary();
      return res.json({ success: true, data: { logs, analytics } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت لاگ‌های هوش مصنوعی' });
    }
  }

  private getAllowedKnowledgeCategories(user?: UserContext): string[] {
    if (!user) return [];
    const role = String(user.role || '').trim().toUpperCase();
    if (role === 'ADMIN' || role === 'ADMINISTRATOR' || role === 'HSE_MANAGER' || checkUserHasPermission(user, '*')) {
      return ['GENERAL', 'STANDARDS', 'PTW', 'HEALTH', 'SAFETY', 'ENVIRONMENT', '5S', 'INCIDENT', 'OCCUPATIONAL_HEALTH'];
    }
    const categories = ['GENERAL', 'STANDARDS'];
    if (checkUserHasPermission(user, 'ptw:read')) categories.push('PTW');
    if (checkUserHasPermission(user, 'health:read')) categories.push('HEALTH', 'OCCUPATIONAL_HEALTH');
    if (checkUserHasPermission(user, 'safety:read')) categories.push('SAFETY', 'INCIDENT', '5S');
    if (checkUserHasPermission(user, 'environment:read')) categories.push('ENVIRONMENT');
    return categories;
  }

  async listKnowledgeDocs(req: Request, res: Response) {
    try {
      const docs = await aiRagService.listDocuments(this.getAllowedKnowledgeCategories(req.user), req.user);
      return res.json({ success: true, data: docs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت فهرست اسناد پایگاه دانش' });
    }
  }

  private validateKnowledgeAccessControl(input: any) {
    if (input === undefined) return undefined;
    if (input === null) throw new Error('ساختار سطح دسترسی سند نامعتبر است.');
    if (typeof input !== 'object' || Array.isArray(input)) throw new Error('ساختار سطح دسترسی سند نامعتبر است.');
    const strings = (value: any, field: string): string[] | undefined => {
      if (value === undefined) return undefined;
      if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error('مقدار نامعتبر برای ' + field);
      return [...new Set(value.map((item: string) => item.trim()))];
    };
    const ids = (value: any, field: string): number[] | undefined => {
      if (value === undefined) return undefined;
      if (!Array.isArray(value) || value.length > 500 || value.some(item => !Number.isInteger(Number(item)) || Number(item) <= 0)) throw new Error('مقدار نامعتبر برای ' + field);
      return [...new Set(value.map(Number))];
    };
    return {
      allowedRoles: strings(input.allowedRoles, 'allowedRoles'),
      requiredPermissions: strings(input.requiredPermissions, 'requiredPermissions'),
      userUids: strings(input.userUids, 'userUids'),
      departmentIds: ids(input.departmentIds, 'departmentIds'),
      unitIds: ids(input.unitIds, 'unitIds'),
    };
  }

  async createKnowledgeDoc(req: Request, res: Response) {
    const { title, content, docType, category, summary } = req.body;
    if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || !content.trim()) {
      return res.status(400).json({ success: false, message: 'عنوان و متن معتبر سند الزامی هستند.' });
    }
    if (title.trim().length > 200 || Buffer.byteLength(content, 'utf8') > 256 * 1024) {
      return res.status(413).json({ success: false, message: 'حداکثر طول عنوان ۲۰۰ نویسه و حجم متن سند ۲۵۶ کیلوبایت است.' });
    }
    if (summary !== undefined && (typeof summary !== 'string' || summary.length > 2000)) {
      return res.status(400).json({ success: false, message: 'خلاصه سند نامعتبر یا بیش از حد مجاز است.' });
    }
    if (docType !== undefined && (typeof docType !== 'string' || docType.length > 64)) {
      return res.status(400).json({ success: false, message: 'نوع سند نامعتبر است.' });
    }
    const normalizedCategory = typeof category === 'string' && category.trim()
      ? category.trim().toUpperCase()
      : 'GENERAL';
    if (!this.getAllowedKnowledgeCategories(req.user).includes(normalizedCategory)) {
      return res.status(403).json({ success: false, message: 'مجوز ایجاد سند در این دسته‌بندی را ندارید.' });
    }

    let accessControl: ReturnType<AIController['validateKnowledgeAccessControl']>;
    try {
      accessControl = this.validateKnowledgeAccessControl(req.body.accessControl);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'ساختار سطح دسترسی سند نامعتبر است.' });
    }

    if (req.body.accessControl !== undefined) {
      const role = String(req.user?.role || '').trim().toUpperCase();
      const canManageAcl = role === 'ADMIN' || role === 'ADMINISTRATOR' ||
        checkUserHasPermission(req.user, 'documents:manage_acl');
      if (!canManageAcl) {
        return res.status(403).json({ success: false, message: 'تعریف سطح دسترسی اختصاصی سند فقط برای مدیر مجاز است.' });
      }
    }

    try {
      const result = await aiRagService.indexDocument({
        title: title.trim(),
        content,
        docType,
        category: normalizedCategory,
        summary,
        accessControl,
        uploadedBy: req.user?.username || req.user?.name || 'system',
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
      const canAccessDocument = await aiRagService.canAccessDocument(
        id,
        this.getAllowedKnowledgeCategories(req.user),
        req.user,
      );
      if (!canAccessDocument) {
        return res.status(404).json({ success: false, message: 'سند یافت نشد یا دسترسی حذف آن مجاز نیست.' });
      }

      await aiRagService.deleteDocument(id);
      return res.json({ success: true, message: 'سند با موفقیت حذف گردید.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در حذف سند' });
    }
  }

  async queryKnowledge(req: Request, res: Response) {
    const { query, category, topK } = req.body;
    if (typeof query !== 'string' || !query.trim() || query.length > 4000) {
      return res.status(400).json({ success: false, message: 'عبارت جستجو الزامی است و نباید بیش از ۴۰۰۰ نویسه باشد.' });
    }

    try {
      const allowedCategories = this.getAllowedKnowledgeCategories(req.user);
      if (category && category !== 'ALL' && !allowedCategories.includes(String(category))) {
        return res.status(403).json({ success: false, message: 'دسترسی به این دسته از اسناد مجاز نیست.' });
      }
      const requestedTopK = topK ? Number(topK) : 4;
      const results = await aiRagService.queryRelevantChunks(query, {
        category, topK: Number.isFinite(requestedTopK) ? Math.min(Math.max(requestedTopK, 1), 10) : 4,
        allowedCategories, userContext: req.user,
      });
      return res.json({ success: true, data: results });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در جستجوی معنایی' });
    }
  }

  async generateBPMN(req: Request, res: Response) {
    const { description, category, priority } = req.body;
    if (typeof description !== 'string' || !description.trim() || description.length > 8000) {
      return res.status(400).json({ success: false, message: 'شرح فرآیند الزامی است و نباید بیش از ۸۰۰۰ نویسه باشد.' });
    }
    if (category !== undefined && (typeof category !== 'string' || category.length > 64)) {
      return res.status(400).json({ success: false, message: 'دسته‌بندی فرآیند نامعتبر است.' });
    }
    if (priority !== undefined && (typeof priority !== 'string' || priority.length > 32)) {
      return res.status(400).json({ success: false, message: 'اولویت فرآیند نامعتبر است.' });
    }

    const startedAt = Date.now();
    try {
      const queued = await aiRequestQueue.enqueue(
        () => aiService.generateBPMN(description.trim(), category, priority),
        { userId: req.user?.id, role: req.user?.role }
      );
      const generated = queued.data;
      aiAuditService.log({
        userId: req.user?.id,
        userUid: req.user?.uid,
        userName: req.user?.name || req.user?.username,
        role: req.user?.role,
        assistantId: 'bpmn-generator',
        promptLength: description.length,
        responseLength: JSON.stringify(generated).length,
        toolsUsed: [],
        durationMs: Date.now() - startedAt,
        model: 'hsecore-bpmn-generator',
        success: true,
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, data: generated, queueWaitMs: queued.queueWaitMs });
    } catch (err: any) {
      return res.status(503).json({ success: false, message: err.message || 'سرویس تولید فرآیند موقتاً در دسترس نیست.' });
    }
  }
}

export const aiController = new AIController();

