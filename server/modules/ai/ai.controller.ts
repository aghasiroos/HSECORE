import { Request, Response } from 'express';
import { aiService } from './ai.service.ts';
import { aiOrchestrator } from './ai.orchestrator.ts';
import { aiRequestQueue } from './ai.queue.ts';
import { aiAuditService, normalizeAILogLimit } from './ai.audit.ts';
import { aiRagService } from './ai.rag.service.ts';
import { aiSessionService } from './ai.sessions.ts';
import { aiModelManager } from './ai.model-manager.ts';
import { aiJobManager } from './ai.job-manager.ts';
import { checkUserHasPermission, type UserContext } from '../../core/middleware/auth.ts';
import { config } from '../../core/config.ts';
import { localAIProvider } from './ai.local-provider.ts';
import { AIMemoryEstimator } from './ai.memory-estimator.ts';
import { aiModuleRegistry } from './ai.module-registry.ts';

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

  private logModelLifecycleAudit(
    req: Request,
    actionModelTag: string,
    targetModelName: string,
    startedAt: number,
    success: boolean,
  ) {
    aiAuditService.log({
      userId: req.user?.id,
      userUid: req.user?.uid,
      userName: req.user?.name || req.user?.username,
      role: req.user?.role,
      assistantId: 'GENERAL_HSE',
      promptLength: targetModelName.length,
      responseLength: 0,
      toolsUsed: [],
      durationMs: Date.now() - startedAt,
      model: actionModelTag,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  async pullModel(req: Request, res: Response) {
    const { modelName } = req.body;
    if (!modelName || typeof modelName !== 'string') {
      return res.status(400).json({ success: false, message: 'نام مدل الزامی است.' });
    }

    const startedAt = Date.now();
    try {
      const result = await aiService.pullModel(modelName);
      this.logModelLifecycleAudit(req, 'ollama-model-pull', modelName, startedAt, result.success);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      this.logModelLifecycleAudit(req, 'ollama-model-pull', modelName, startedAt, false);
      return res.status(500).json({ success: false, message: err.message || 'خطا در شروع بارگیری مدل' });
    }
  }

  async deleteModel(req: Request, res: Response) {
    const modelName = req.params.name;
    if (!modelName) {
      return res.status(400).json({ success: false, message: 'نام مدل مشخص نشده است.' });
    }

    const startedAt = Date.now();
    try {
      const result = await aiService.deleteModel(modelName);
      this.logModelLifecycleAudit(req, 'ollama-model-delete', modelName, startedAt, result.success);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      this.logModelLifecycleAudit(req, 'ollama-model-delete', modelName, startedAt, false);
      return res.status(500).json({ success: false, message: err.message || 'خطا در حذف مدل' });
    }
  }

  async chat(req: Request, res: Response) {
    const body = req.body || {};
    const message = body.message;
    if (typeof message !== 'string' || !message.trim() || message.length > 12000) {
      return res.status(400).json({ success: false, message: 'متن پیام الزامی است و نباید بیش از ۱۲۰۰۰ نویسه باشد.' });
    }
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'احراز هویت برای تحلیل داده‌های سامانه الزامی است.' });
    }

    const history = Array.isArray(body.history)
      ? body.history.slice(-8).filter((item: any) =>
          item && (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string' && item.content.length <= 12000
        ).map((item: any) => ({ role: item.role, content: item.content }))
      : [];
    const selectedModules = Array.isArray(body.selectedModules)
      ? body.selectedModules.filter((id: unknown) => typeof id === 'string').slice(0, 40)
      : [];
    const startedAt = Date.now();
    const streaming = body.stream === true;
    const abortController = new AbortController();

    if (streaming) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      res.on('close', () => {
        if (!res.writableEnded) abortController.abort();
      });
    }

    try {
      // All user-facing chat now goes through the HSECORE orchestrator.
      // The orchestrator performs permission-checked, read-only domain retrieval
      // before asking the selected local model to interpret the resulting evidence.
      const result = await aiOrchestrator.processChat({
        message: message.trim(),
        history,
        model: typeof body.model === 'string' ? body.model : undefined,
        selectedModules,
        contextTokens: Number.isInteger(body.contextTokens) && body.contextTokens >= 1024 && body.contextTokens <= 32768
          ? body.contextTokens : undefined,
        signal: streaming ? abortController.signal : undefined,
        allowTools: typeof body.allowTools === 'boolean' ? body.allowTools : true,
      }, user);

      if (streaming) {
        if (!res.destroyed && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ token: result.reply })}\n\n`);
          res.write(`data: ${JSON.stringify({
            done: true,
            model: result.model,
            durationMs: result.durationMs,
            toolsUsed: result.toolsUsed,
            citations: result.citations,
            queueWaitMs: result.queueWaitMs,
            assistantId: result.assistantId,
          })}\n\n`);
          (res as any).flush?.();
          res.end();
        }
        return;
      }

      return res.json({
        success: true,
        reply: result.reply,
        assistantId: result.assistantId,
        toolsUsed: result.toolsUsed,
        citations: result.citations,
        durationMs: result.durationMs,
        model: result.model,
        queueWaitMs: result.queueWaitMs,
      });
    } catch (err: any) {
      const messageText = String(err?.message || 'خطا در اجرای تحلیل هوشمند.');
      aiAuditService.log({
        userId: user.id,
        userUid: user.uid,
        userName: user.name || user.username,
        role: user.role,
        assistantId: 'GENERAL_HSE',
        promptLength: message.length,
        responseLength: 0,
        toolsUsed: selectedModules,
        durationMs: Date.now() - startedAt,
        model: typeof body.model === 'string' ? body.model : config.aiEngine.defaultChatModel,
        success: false,
        errorMessage: messageText,
        timestamp: new Date().toISOString(),
      });
      if (streaming) {
        if (!res.destroyed && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: messageText })}\n\n`);
          (res as any).flush?.();
          res.end();
        }
        return;
      }
      return res.status(messageText.includes('دسترسی') || messageText.includes('قابل‌دسترسی') ? 403 : 503)
        .json({ success: false, message: messageText });
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
        assistantId: 'GENERAL_HSE',
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

  // ---------- Persistent Chat Sessions ----------
  private requireUser(req: Request): UserContext {
    if (!req.user) throw new Error('احراز هویت الزامی است.');
    return {
      id: req.user.id,
      uid: req.user.uid,
      name: req.user.name || req.user.username,
      role: req.user.role,
      permissions: req.user.permissions,
      personnelCode: req.user.personnelCode,
      department: req.user.department,
    };
  }

  async listSessions(req: Request, res: Response) {
    try {
      const user = this.requireUser(req);
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const sessions = await aiSessionService.listSessions(user, limit);
      return res.json({ success: true, data: sessions });
    } catch (err: any) {
      return res.status(err.message?.includes('احراز') ? 401 : 500).json({
        success: false,
        message: err.message || 'خطا در دریافت فهرست گفتگوها',
      });
    }
  }

  async createSession(req: Request, res: Response) {
    try {
      const user = this.requireUser(req);
      const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 200) : undefined;
      const assistantId = typeof req.body?.assistantId === 'string' ? req.body.assistantId : 'GENERAL_HSE';
      const session = await aiSessionService.createSession(user, title, assistantId);
      return res.status(201).json({ success: true, data: session });
    } catch (err: any) {
      return res.status(err.message?.includes('احراز') ? 401 : 500).json({
        success: false,
        message: err.message || 'خطا در ایجاد گفتگو',
      });
    }
  }

  async getSessionMessages(req: Request, res: Response) {
    try {
      const user = this.requireUser(req);
      const sessionId = req.params.id;
      if (!sessionId) return res.status(400).json({ success: false, message: 'شناسه گفتگو الزامی است.' });
      const messages = await aiSessionService.getMessages(sessionId, user);
      return res.json({ success: true, data: messages });
    } catch (err: any) {
      const status = err.message?.includes('مجاز نیست') ? 403 : err.message?.includes('احراز') ? 401 : 500;
      return res.status(status).json({ success: false, message: err.message || 'خطا در دریافت پیام‌ها' });
    }
  }

  async appendSessionMessage(req: Request, res: Response) {
    try {
      const user = this.requireUser(req);
      const sessionId = req.params.id;
      const { role, content, toolsUsed, citations, durationMs, model } = req.body || {};
      if (!sessionId) return res.status(400).json({ success: false, message: 'شناسه گفتگو الزامی است.' });
      if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return res.status(400).json({ success: false, message: 'نقش پیام نامعتبر است.' });
      }
      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ success: false, message: 'متن پیام الزامی است.' });
      }
      const saved = await aiSessionService.appendMessage(sessionId, user, {
        role,
        content: content.slice(0, 50000),
        toolsUsed: Array.isArray(toolsUsed) ? toolsUsed : undefined,
        citations: Array.isArray(citations) ? citations : undefined,
        durationMs: typeof durationMs === 'number' ? durationMs : undefined,
        model: typeof model === 'string' ? model : undefined,
      });
      return res.status(201).json({ success: true, data: saved });
    } catch (err: any) {
      const status = err.message?.includes('مجاز نیست') ? 403 : err.message?.includes('احراز') ? 401 : 500;
      return res.status(status).json({ success: false, message: err.message || 'خطا در ذخیره پیام' });
    }
  }

  async deleteSession(req: Request, res: Response) {
    try {
      const user = this.requireUser(req);
      const sessionId = req.params.id;
      if (!sessionId) return res.status(400).json({ success: false, message: 'شناسه گفتگو الزامی است.' });
      await aiSessionService.deleteSession(sessionId, user);
      return res.json({ success: true });
    } catch (err: any) {
      const status = err.message?.includes('مجاز نیست') ? 403 : err.message?.includes('احراز') ? 401 : 500;
      return res.status(status).json({ success: false, message: err.message || 'خطا در حذف گفتگو' });
    }
  }

  async importLocalSessions(req: Request, res: Response) {
    try {
      const user = this.requireUser(req);
      const sessions = req.body?.sessions;
      if (!Array.isArray(sessions)) {
        return res.status(400).json({ success: false, message: 'آرایه sessions الزامی است.' });
      }
      const result = await aiSessionService.importLocalSessions(user, sessions);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(err.message?.includes('احراز') ? 401 : 500).json({
        success: false,
        message: err.message || 'خطا در مهاجرت تاریخچه محلی',
      });
    }
  }

  async getModuleCoverage(req: Request, res: Response) {
    try {
      const coverage = await aiOrchestrator.getModuleCoverage(req.user);
      return res.json({ success: true, data: coverage });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت گزارش پوشش' });
    }
  }

  async getModuleRegistry(req: Request, res: Response) {
    try {
      const grouped = aiModuleRegistry.getGroupedModules(req.user);
      const modules = aiModuleRegistry.getAllModules();
      return res.json({
        success: true,
        data: {
          totalModules: modules.length,
          groups: grouped,
          modules,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت رجیستری ماژول‌ها' });
    }
  }

  async listProviders(_req: Request, res: Response) {
    try {
      const runtime = aiService.listProviders();
      const fromDb = await aiModelManager.listProvidersFromDb();
      return res.json({
        success: true,
        data: {
          providers: fromDb.length ? fromDb : runtime,
          runtimeProviders: runtime,
          defaultProviderId: aiService.getDefaultProviderId(),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت فهرست موتورهای هوش مصنوعی' });
    }
  }

  async listAssignments(_req: Request, res: Response) {
    try {
      const data = await aiModelManager.listAssignments();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت تخصیص مدل‌ها' });
    }
  }

  async upsertAssignment(req: Request, res: Response) {
    try {
      const serviceKey = req.params.serviceKey || req.body?.serviceKey;
      const saved = await aiModelManager.upsertAssignment({
        serviceKey,
        providerId: req.body?.providerId,
        modelRef: req.body?.modelRef,
        fallbackProviderId: req.body?.fallbackProviderId,
        fallbackModelRef: req.body?.fallbackModelRef,
        contextLimit: req.body?.contextLimit != null ? Number(req.body.contextLimit) : undefined,
        enabled: req.body?.enabled,
      });
      return res.json({ success: true, data: saved });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'خطا در ذخیره تخصیص مدل' });
    }
  }

  async getResourceSettings(_req: Request, res: Response) {
    try {
      const data = await aiModelManager.getResourceSettings();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت تنظیمات منابع' });
    }
  }

  async putResourceSettings(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const allowed = [
        'max_concurrency',
        'request_timeout_ms',
        'context_tokens',
        'default_chat_model',
        'default_embed_model',
      ];
      for (const key of allowed) {
        if (body[key] != null && body[key] !== '') {
          await aiModelManager.setSetting(key, String(body[key]).slice(0, 200));
        }
      }
      const data = await aiModelManager.getResourceSettings();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'خطا در ذخیره تنظیمات منابع' });
    }
  }

  async syncInstalledModels(req: Request, res: Response) {
    try {
      const providerId = typeof req.body?.providerId === 'string' ? req.body.providerId : 'ollama';
      const count = await aiModelManager.syncInstalledModelsFromProvider(providerId);
      return res.json({ success: true, data: { synced: count, providerId } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در همگام‌سازی مدل‌ها' });
    }
  }


  async listJobs(req: Request, res: Response) {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
      const data = await aiJobManager.listJobs(limit);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت فهرست عملیات' });
    }
  }

  async getJob(req: Request, res: Response) {
    try {
      const job = await aiJobManager.getJob(req.params.id);
      if (!job) return res.status(404).json({ success: false, message: 'عملیات یافت نشد.' });
      return res.json({ success: true, data: job });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت وضعیت عملیات' });
    }
  }

  async enqueuePullJob(req: Request, res: Response) {
    try {
      const modelName = req.body?.modelName || req.body?.model || req.body?.name;
      if (!modelName || typeof modelName !== 'string') {
        return res.status(400).json({ success: false, message: 'نام مدل الزامی است.' });
      }
      const createdBy = req.user?.uid || req.user?.username || String(req.user?.id || '');
      const job = await aiJobManager.enqueuePull(modelName.trim(), createdBy);
      return res.status(202).json({ success: true, data: job });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'خطا در صف‌گذاری دریافت مدل' });
    }
  }

  async enqueueDeleteJob(req: Request, res: Response) {
    try {
      const modelName = req.body?.modelName || req.body?.model || req.body?.name;
      if (!modelName || typeof modelName !== 'string') {
        return res.status(400).json({ success: false, message: 'نام مدل الزامی است.' });
      }
      const createdBy = req.user?.uid || req.user?.username || String(req.user?.id || '');
      const job = await aiJobManager.enqueueDelete(modelName.trim(), createdBy);
      return res.status(202).json({ success: true, data: job });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'خطا در صف‌گذاری حذف مدل' });
    }
  }

  async getMemoryMetrics(_req: Request, res: Response) {
    try {
      const system = AIMemoryEstimator.getSystemMemoryMetrics();
      const loadedModels = await localAIProvider.getLoadedModels();
      const diagnostics = AIMemoryEstimator.getOomDiagnostics();
      return res.json({
        success: true,
        data: {
          system,
          loadedModels,
          diagnostics,
          queue: aiRequestQueue.telemetry,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در دریافت وضعیت حافظه' });
    }
  }

  async unloadModel(req: Request, res: Response) {
    try {
      const modelName = typeof req.body?.modelName === 'string' ? req.body.modelName.trim() : undefined;
      const success = await localAIProvider.unloadModel(modelName);
      return res.json({
        success,
        message: success
          ? (modelName ? `مدل ${modelName} با موفقیت از حافظه RAM تخلیه شد.` : 'تمامی مدل‌های بارگذاری‌شده در RAM با موفقیت تخلیه شدند.')
          : 'عملیات آزادسازی حافظه مدل ناموفق بود.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'خطا در آزادسازی مدل از RAM' });
    }
  }

}

export const aiController = new AIController();

