/**
 * Internal Automation Engine REST Router
 * Provides endpoints for Rule Management, Transactional Outbox monitoring, and Execution Audit Trail.
 */
import { Router, Request, Response } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  automationRules,
  automationEventsOutbox,
  automationExecutionLogs,
} from '../../src/db/schema.ts';
import { requireAuth, isGlobalAdminUser } from '../core/middleware/auth.ts';
import { logger } from '../core/logger.ts';
import { publishDomainEvent } from '../services/automation/internalEventBus.ts';
import {
  retryOutboxEventById,
  getAutomationQueueStats,
  processOutboxBatch,
} from '../services/automation/automationWorker.ts';

export const automationRouter = Router();

function isAuthorized(req: Request): boolean {
  const user = (req as any).user;
  const role = String(user?.role || '').toUpperCase();
  return (
    isGlobalAdminUser(user) ||
    ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN', 'SAFETY_OFFICER'].includes(role)
  );
}

function requireAutomationAccess(req: Request, res: Response, next: () => void) {
  if (!isAuthorized(req)) {
    return res.status(403).json({
      success: false,
      message: 'دسترسی غیرمجاز: مدیریت اتوماسیون نیازمند نقش مدیر ارشد یا مدیر HSE است.',
    });
  }
  next();
}

/**
 * GET /api/v1/automation/rules
 * Returns all automation rules sorted by priority
 */
automationRouter.get('/rules', requireAuth, async (_req: Request, res: Response) => {
  try {
    const rules = await db
      .select()
      .from(automationRules)
      .orderBy(automationRules.priority, desc(automationRules.id));

    res.json({
      success: true,
      data: rules,
    });
  } catch (err: any) {
    logger.error('Failed to fetch automation rules', { error: err?.message });
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در دریافت قوانین اتوماسیون.',
    });
  }
});

/**
 * POST /api/v1/automation/rules
 * Creates a new automation rule
 */
automationRouter.post('/rules', requireAuth, requireAutomationAccess, async (req: Request, res: Response) => {
  try {
    const {
      ruleCode,
      nameFa,
      nameEn,
      descriptionFa,
      descriptionEn,
      eventType,
      sourceModule = 'all',
      priority = 10,
      isActive = true,
      conditions = [],
      actions = [],
    } = req.body;

    if (!ruleCode || !nameFa || !eventType) {
      return res.status(400).json({
        success: false,
        message: 'کد قانون، نام فارسی و نوع رویداد الزامی است.',
      });
    }

    const actor = (req as any).user?.username || 'admin';

    const [created] = await db
      .insert(automationRules)
      .values({
        ruleCode: String(ruleCode).trim().toUpperCase(),
        nameFa: String(nameFa).trim(),
        nameEn: String(nameEn || nameFa).trim(),
        descriptionFa: descriptionFa ? String(descriptionFa).trim() : null,
        descriptionEn: descriptionEn ? String(descriptionEn).trim() : null,
        eventType: String(eventType).trim(),
        sourceModule: String(sourceModule).trim(),
        priority: Number(priority) || 10,
        isActive: Boolean(isActive),
        conditions: Array.isArray(conditions) ? conditions : [],
        actions: Array.isArray(actions) ? actions : [],
        createdBy: actor,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: 'قانون اتوماسیون با موفقیت ایجاد شد.',
      data: created,
    });
  } catch (err: any) {
    logger.error('Failed to create automation rule', { error: err?.message });
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در ایجاد قانون اتوماسیون.',
    });
  }
});

/**
 * PUT /api/v1/automation/rules/:id
 * Updates an existing automation rule
 */
automationRouter.put('/rules/:id', requireAuth, requireAutomationAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      nameFa,
      nameEn,
      descriptionFa,
      descriptionEn,
      eventType,
      sourceModule,
      priority,
      isActive,
      conditions,
      actions,
    } = req.body;

    const [updated] = await db
      .update(automationRules)
      .set({
        ...(nameFa !== undefined && { nameFa: String(nameFa).trim() }),
        ...(nameEn !== undefined && { nameEn: String(nameEn).trim() }),
        ...(descriptionFa !== undefined && { descriptionFa: String(descriptionFa).trim() }),
        ...(descriptionEn !== undefined && { descriptionEn: String(descriptionEn).trim() }),
        ...(eventType !== undefined && { eventType: String(eventType).trim() }),
        ...(sourceModule !== undefined && { sourceModule: String(sourceModule).trim() }),
        ...(priority !== undefined && { priority: Number(priority) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(conditions !== undefined && { conditions: Array.isArray(conditions) ? conditions : [] }),
        ...(actions !== undefined && { actions: Array.isArray(actions) ? actions : [] }),
        updatedAt: new Date(),
      })
      .where(eq(automationRules.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'قانون مورد نظر یافت نشد.',
      });
    }

    res.json({
      success: true,
      message: 'قانون اتوماسیون با موفقیت بروزرسانی شد.',
      data: updated,
    });
  } catch (err: any) {
    logger.error('Failed to update automation rule', { error: err?.message });
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در ویرایش قانون اتوماسیون.',
    });
  }
});

/**
 * PATCH /api/v1/automation/rules/:id/toggle
 * Quickly toggles rule active state
 */
automationRouter.patch('/rules/:id/toggle', requireAuth, requireAutomationAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await db
      .select({ id: automationRules.id, isActive: automationRules.isActive })
      .from(automationRules)
      .where(eq(automationRules.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'قانون یافت نشد.' });
    }

    const nextState = !existing[0].isActive;
    const [updated] = await db
      .update(automationRules)
      .set({ isActive: nextState, updatedAt: new Date() })
      .where(eq(automationRules.id, id))
      .returning();

    res.json({
      success: true,
      message: nextState ? 'قانون فعال شد.' : 'قانون غیرفعال گردید.',
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/**
 * DELETE /api/v1/automation/rules/:id
 * Removes an automation rule
 */
automationRouter.delete('/rules/:id', requireAuth, requireAutomationAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(automationRules).where(eq(automationRules.id, id));
    res.json({
      success: true,
      message: 'قانون اتوماسیون با موفقیت حذف شد.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

/**
 * GET /api/v1/automation/outbox
 * Retrieves queue status and recent transactional outbox items
 */
automationRouter.get('/outbox', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getAutomationQueueStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در دریافت وضعیت صف Outbox.',
    });
  }
});

/**
 * POST /api/v1/automation/outbox/:id/retry
 * Retries a failed or dead-letter outbox event
 */
automationRouter.post('/outbox/:id/retry', requireAuth, requireAutomationAccess, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await retryOutboxEventById(id);
    res.json({
      success: true,
      message: 'رویداد با موفقیت به صف پردازش مجدد ارسال گردید.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در ارسال مجدد رویداد.',
    });
  }
});

/**
 * GET /api/v1/automation/logs
 * Retrieves rule execution audit trail
 */
automationRouter.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const logs = await db
      .select()
      .from(automationExecutionLogs)
      .orderBy(desc(automationExecutionLogs.createdAt))
      .limit(limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در دریافت سوابق ممیزی اجرا.',
    });
  }
});

/**
 * POST /api/v1/automation/test-event
 * Simulates a domain event to test rules and outbox processing
 */
automationRouter.post('/test-event', requireAuth, requireAutomationAccess, async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.username || 'test_operator';
    const { eventType = 'incident.reported', payload = {} } = req.body;

    const published = await publishDomainEvent({
      eventType,
      sourceModule: 'simulator',
      correlationKey: `SIM-${Date.now()}`,
      triggeredBy: actor,
      payload: {
        ...payload,
        isSimulation: true,
        testTimestamp: new Date().toISOString(),
      },
    });

    // Immediate worker pass to execute rules synchronously for the response
    await processOutboxBatch();

    res.json({
      success: true,
      message: 'رویداد آزمایشی با موفقیت در موتور اتوماسیون منتشر و پردازش شد.',
      event: published,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در انتشار رویداد آزمایشی.',
    });
  }
});
