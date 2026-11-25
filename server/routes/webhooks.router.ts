import { Router, Request, Response } from 'express';
import { requireAuth, isGlobalAdminUser } from '../core/middleware/auth.ts';
import {
  getIntegrationConfigFromDb,
  saveIntegrationConfigToDb,
  maskIntegrationConfigForClient,
  generateWebhookSecret,
  executeWebhookDelivery,
  getWebhookDeliveryLogs,
  clearWebhookDeliveryLogs,
  retryWebhookDeliveryById,
  validateWebhookTargetUrl,
  verifyWebhookSignature,
} from '../services/webhookDispatcher.ts';
import { syncSettingsMemoryCache } from './settings.router.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { logger } from '../core/logger.ts';

export const webhooksRouter = Router();

function isAdminOrHseManager(req: Request): boolean {
  const user = (req as any).user;
  const role = String(user?.role || '').toUpperCase();
  return isGlobalAdminUser(user) || ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN'].includes(role);
}

function requireWebhookAdmin(req: Request, res: Response, next: () => void) {
  if (!isAdminOrHseManager(req)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_ADMIN_ONLY',
      message: 'دسترسی غیرمجاز: فقط مدیران ارشد سامانه و مدیر HSE مجاز به مدیریت وب‌هوک و اتوماسیون هستند.',
    });
  }
  next();
}

/**
 * GET /api/v1/webhooks/config
 * Returns integration configuration with masked secrets and recent delivery logs
 */
webhooksRouter.get('/config', requireAuth, requireWebhookAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await getIntegrationConfigFromDb();
    const logs = await getWebhookDeliveryLogs(50);
    res.json({
      success: true,
      data: maskIntegrationConfigForClient(config),
      logs,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در بارگذاری تنظیمات وب‌هوک از پایگاه داده.',
    });
  }
});

/**
 * POST /api/v1/webhooks/config
 * Validates URL against SSRF and persists configuration to primary database
 */
webhooksRouter.post('/config', requireAuth, requireWebhookAdmin, async (req: Request, res: Response) => {
  try {
    const incoming = req.body?.value ?? req.body ?? {};
    const { config, validation } = await saveIntegrationConfigToDb(incoming);
    syncSettingsMemoryCache('hse_integration_config', config);

    const maskedConfig = maskIntegrationConfigForClient(config);
    broadcastDataMutation('webhooks', 'update', { config: maskedConfig }, {
      module: 'WEBHOOKS',
      actorId: (req as any).user?.uid,
    });

    res.json({
      success: true,
      message: 'تنظیمات وب‌هوک و یکپارچه‌سازی اتوماسیون با موفقیت در پایگاه داده اصلی ذخیره شد.',
      data: maskedConfig,
      urlValidation: validation,
    });
  } catch (err: any) {
    const status = err?.statusCode || 400;
    res.status(status).json({
      success: false,
      code: err?.code || 'WEBHOOK_CONFIG_INVALID',
      message: err?.message || 'خطا در اعتبارسنجی و ذخیره تنظیمات وب‌هوک.',
    });
  }
});

/**
 * POST /api/v1/webhooks/rotate-secret
 * Generates a new cryptographically secure HMAC-SHA256 secret key on the server
 */
webhooksRouter.post('/rotate-secret', requireAuth, requireWebhookAdmin, async (_req: Request, res: Response) => {
  try {
    const newSecret = generateWebhookSecret();
    const { config } = await saveIntegrationConfigToDb({ webhookSecret: newSecret });
    syncSettingsMemoryCache('hse_integration_config', config);

    const maskedSecret = maskIntegrationConfigForClient(config).webhookSecret;
    broadcastDataMutation('webhooks', 'rotate_secret', { maskedSecret }, {
      module: 'WEBHOOKS',
      actorId: (_req as any).user?.uid,
    });

    res.json({
      success: true,
      message: 'کلید امنیتی HMAC-SHA256 جدید تولید و در پایگاه داده ذخیره شد.',
      newSecretOnce: newSecret,
      maskedSecret,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در تولید کلید امنیتی جدید.',
    });
  }
});

/**
 * POST /api/v1/webhooks/validate-url
 * Validates a candidate webhook URL against SSRF and DNS rebinding rules
 */
webhooksRouter.post('/validate-url', requireAuth, requireWebhookAdmin, async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    const result = await validateWebhookTargetUrl(rawUrl);
    res.status(result.valid ? 200 : 400).json({
      success: result.valid,
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      valid: false,
      reasonFa: err?.message || 'خطا در بررسی آدرس مقصد.',
    });
  }
});

/**
 * POST /api/v1/webhooks/test-ping
 * Dispatches a real server-side `system.test_ping` webhook with HMAC-SHA256 signature and anti-false-positive verification
 */
webhooksRouter.post('/test-ping', requireAuth, requireWebhookAdmin, async (req: Request, res: Response) => {
  try {
    const storedConfig = await getIntegrationConfigFromDb();
    const candidateUrl = String(req.body?.webhookUrl ?? storedConfig.webhookUrl ?? '').trim();
    const customSecret =
      req.body?.webhookSecret && !String(req.body.webhookSecret).includes('••••')
        ? String(req.body.webhookSecret).trim()
        : storedConfig.webhookSecret;

    if (!candidateUrl) {
      return res.status(400).json({
        success: false,
        code: 'EMPTY_WEBHOOK_URL',
        message: 'لطفاً ابتدا آدرس وب‌هوک مقصد (Endpoint URL) را وارد کنید.',
      });
    }

    const actor = (req as any).user?.username || 'admin';
    const deliveryLog = await executeWebhookDelivery({
      eventType: 'system.test_ping',
      targetUrl: candidateUrl,
      secret: customSecret,
      moduleName: 'system_integration_diagnostics',
      triggeredBy: actor,
      maxAttempts: 1, // Direct diagnostic test should report immediate result without long wait
      forceDispatch: true,
      data: {
        ping: 'pong',
        diagnostic: true,
        triggeredBy: actor,
        timestamp: new Date().toISOString(),
        enabledEvents: {
          'incident.reported': Boolean(storedConfig.webhookOnIncident),
          'warning.issued': Boolean(storedConfig.webhookOnWarning),
          'permit.status_adjusted': Boolean(storedConfig.webhookOnPermit),
          'heat_stress.level_change': Boolean(storedConfig.webhookOnHeat),
        },
        messageFa: 'پیام آزمایشی صحت اتصال، امضای HMAC-SHA256 و تایید گردش‌کار از سامانه HSECORE',
      },
    });

    const isSuccess = deliveryLog.status === 'DELIVERED' && deliveryLog.verifiedWorkflowAck;
    const statusCode = isSuccess ? 200 : deliveryLog.status === 'UNVERIFIED_RESPONSE' ? 200 : 422;

    res.status(statusCode).json({
      success: isSuccess,
      verifiedWorkflowAck: deliveryLog.verifiedWorkflowAck,
      status: deliveryLog.status,
      httpStatus: deliveryLog.httpStatus,
      latencyMs: deliveryLog.latencyMs,
      message: deliveryLog.verificationReason,
      delivery: deliveryLog,
    });
  } catch (err: any) {
    logger.error('Failed to execute webhook test-ping', { error: err?.message });
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در ارسال بسته آزمایشی وب‌هوک.',
    });
  }
});

/**
 * GET /api/v1/webhooks/logs
 * Retrieves persistent webhook delivery logs
 */
webhooksRouter.get('/logs', requireAuth, requireWebhookAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit) || 50, 100) : 50;
    const logs = await getWebhookDeliveryLogs(limit);
    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در دریافت سوابق ارسال وب‌هوک.',
    });
  }
});

/**
 * DELETE /api/v1/webhooks/logs
 * Clears stored webhook delivery logs
 */
webhooksRouter.delete('/logs', requireAuth, requireWebhookAdmin, async (_req: Request, res: Response) => {
  try {
    await clearWebhookDeliveryLogs();
    broadcastDataMutation('webhooks', 'clear_logs', { cleared: true }, {
      module: 'WEBHOOKS',
      actorId: (_req as any).user?.uid,
    });

    res.json({
      success: true,
      message: 'سوابق ارسال وب‌هوک با موفقیت پاک‌سازی شد.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در پاک‌سازی سوابق ارسال وب‌هوک.',
    });
  }
});

/**
 * POST /api/v1/webhooks/logs/:id/retry
 * Manually retries a specific webhook delivery
 */
webhooksRouter.post('/logs/:id/retry', requireAuth, requireWebhookAdmin, async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.username || 'admin';
    const retried = await retryWebhookDeliveryById(req.params.id, actor);
    broadcastDataMutation('webhooks', 'retry', { id: req.params.id, status: retried.status }, {
      module: 'WEBHOOKS',
      recordId: String(req.params.id),
      actorId: (req as any).user?.uid,
    });

    res.json({
      success: retried.status === 'DELIVERED' && retried.verifiedWorkflowAck,
      message: retried.verificationReason,
      delivery: retried,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({
      success: false,
      message: err?.message || 'خطا در تلاش مجدد ارسال وب‌هوک.',
    });
  }
});

/**
 * POST /api/v1/webhooks/inbound
 * Secure Inbound Webhook Endpoint for receiving signed callbacks from n8n, Make, or Camunda 8
 * Enforces HMAC-SHA256 verification (`X-HSE-Signature-256`) and 5-minute anti-replay timestamp check (`X-HSE-Timestamp`).
 */
webhooksRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    const config = await getIntegrationConfigFromDb();
    const signatureHeader = req.header('X-HSE-Signature-256') || req.header('X-HSE-Signature');
    const timestampHeader = req.header('X-HSE-Timestamp');
    const rawBody = JSON.stringify(req.body || {});

    const verification = verifyWebhookSignature({
      rawBody,
      signatureHeader,
      secret: config.webhookSecret,
      timestampHeader,
      toleranceSeconds: 300,
    });

    if (!verification.valid) {
      logger.warn('Rejected unauthorized inbound webhook callback', {
        reason: verification.reason,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        code: verification.reason || 'INVALID_HMAC_SIGNATURE',
        message: 'امضای امنیتی HMAC یا مهر زمانی درخواست ورودی نامعتبر است.',
      });
    }

    res.status(200).json({
      success: true,
      workflowExecuted: true,
      receivedAt: new Date().toISOString(),
      correlationKey: req.body?.correlationKey || req.body?.event_id || null,
      message: 'Inbound automation callback verified and accepted by HSECORE.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'خطا در پردازش وب‌هوک ورودی.',
    });
  }
});
