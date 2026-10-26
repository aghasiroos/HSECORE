import crypto from 'crypto';
import dns from 'dns';
import net from 'net';
import { db, withDbRetry } from '../../src/db/index.ts';
import { systemSettings } from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { publishDomainEvent } from './automation/internalEventBus.ts';

export type WebhookEventType =
  | 'incident.reported'
  | 'warning.issued'
  | 'permit.status_adjusted'
  | 'heat_stress.level_change'
  | 'system.test_ping';

export type WebhookDeliveryStatus =
  | 'DELIVERED'
  | 'UNVERIFIED_RESPONSE'
  | 'RETRY_SCHEDULED'
  | 'FAILED'
  | 'SKIPPED';

export interface WebhookIntegrationConfig {
  weatherProvider?: string;
  weatherStationUrl?: string;
  weatherSyncInterval?: number;
  smsProvider?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  smsAlertHighHeat?: boolean;
  smsAlertIncident?: boolean;
  smsAlertPermitExpiry?: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  webhookOnHeat: boolean;
  webhookOnPermit: boolean;
  webhookOnWarning: boolean;
  webhookOnIncident: boolean;
  erpSyncEnabled?: boolean;
  erpEndpointUrl?: string;
  erpSyncSchedule?: string;
  aiEngineEnabled?: boolean;
  aiProvider?: string;
  aiModelName?: string;
  aiApiKey?: string;
  updatedAt?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  eventId: string;
  idempotencyKey: string;
  eventType: WebhookEventType;
  targetUrl: string;
  status: WebhookDeliveryStatus;
  verifiedWorkflowAck: boolean;
  verificationReason: string;
  httpStatus: number | null;
  responseContentType: string | null;
  latencyMs: number;
  attemptCount: number;
  maxAttempts: number;
  signatureHeader: string;
  timestampHeader: string;
  requestPayload: Record<string, any>;
  responseSnippet: string;
  errorMessage?: string;
  triggeredBy?: string;
  createdAt: string;
  completedAt: string;
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  resolvedIps?: string[];
  reasonFa?: string;
  reasonEn?: string;
  code?: string;
}

export const INTEGRATION_CONFIG_KEY = 'hse_integration_config';
export const WEBHOOK_DELIVERY_LOGS_KEY = 'hse_webhook_delivery_logs';
const MAX_STORED_DELIVERY_LOGS = 100;
const WEBHOOK_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ATTEMPTS = 3;

// Unified in-memory cache synchronized with PostgreSQL system_settings
let cachedIntegrationConfig: WebhookIntegrationConfig | null = null;
let cachedDeliveryLogs: WebhookDeliveryLog[] | null = null;
const deliveredIdempotencyKeys = new Map<string, { deliveryId: string; timestamp: number }>();
const lastHeatStressLevelByLocation = new Map<string, string>();

// Sensitive PII and large binary keys that must NEVER leave HSECORE via external webhooks
const SENSITIVE_PII_KEYS = new Set([
  'nationalcode',
  'national_code',
  'codemelli',
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'webhooksecret',
  'smsapikey',
  'aiapikey',
  'mobile',
  'phonenumber',
  'phone_number',
  'phone',
  'signatureimage',
  'digitalsignature',
  'profilephoto',
  'avatar',
  'medicalnotes',
  'diagnosis',
]);

/**
 * Generates a cryptographically strong HMAC secret key
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Masks a sensitive secret for safe display in UI responses
 */
export function maskSecretValue(secret?: string | null): string {
  if (!secret || typeof secret !== 'string') return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 10) return '••••••••';
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}${'•'.repeat(12)}${suffix}`;
}

/**
 * Checks whether a value sent from the client is a masked placeholder
 */
export function isMaskedSecretPlaceholder(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return val.includes('••••');
}

/**
 * Checks if an IPv4 address belongs to private, loopback, link-local, CGNAT, multicast, or reserved ranges
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private RFC1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private RFC1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 & 192.0.2.0/24 (IETF / TEST-NET-1)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  // 192.168.0.0/16 (Private RFC1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2) & 203.0.113.0/24 (TEST-NET-3)
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved/Broadcast)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, unspecified, link-local, unique-local, or IPv4-mapped private
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') {
    return true;
  }
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:192.168.1.1)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.slice('::ffff:'.length);
    if (net.isIPv4(v4Part)) {
      return isPrivateOrReservedIPv4(v4Part);
    }
    return true;
  }
  // Unique Local Unicast (fc00::/7 -> fc00..fdff)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  // Link-Local Unicast (fe80::/10 -> fe80..febf)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }
  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }
  return false;
}

/**
 * Checks if any IP address (v4 or v6) is internal, loopback, or reserved
 */
export function isPrivateOrInternalIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  if (version === 6) return isPrivateOrReservedIPv6(ip);
  return true;
}

/**
 * Validates a webhook destination URL against SSRF, forbidden protocols, internal hostnames, and DNS rebinding
 */
export async function validateWebhookTargetUrl(
  rawUrl: string,
  options?: { skipDnsLookup?: boolean; allowInternalTestServer?: boolean }
): Promise<UrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      valid: false,
      code: 'EMPTY_URL',
      reasonFa: 'آدرس وب‌هوک (Endpoint URL) وارد نشده است.',
      reasonEn: 'Webhook destination URL is required.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      valid: false,
      code: 'INVALID_URL_FORMAT',
      reasonFa: 'ساختار آدرس وب‌هوک نامعتبر است.',
      reasonEn: 'Invalid URL syntax.',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      valid: false,
      code: 'FORBIDDEN_PROTOCOL',
      reasonFa: `پروتکل ${parsed.protocol} مجاز نیست؛ فقط پروتکل امن HTTPS (یا HTTP در محیط مجاز) قابل استفاده است.`,
      reasonEn: `Protocol ${parsed.protocol} is forbidden. Only HTTPS/HTTP is permitted.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      code: 'EMBEDDED_CREDENTIALS_FORBIDDEN',
      reasonFa: 'قرار دادن نام کاربری و رمز عبور در داخل آدرس URL به دلایل امنیتی مجاز نیست.',
      reasonEn: 'Embedded credentials in webhook URL are forbidden.',
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    return {
      valid: false,
      code: 'INVALID_HOSTNAME',
      reasonFa: 'نام میزبان (Hostname) در آدرس مقصد معتبر نیست.',
      reasonEn: 'Missing or invalid hostname.',
    };
  }

  if (!options?.allowInternalTestServer) {
    const blockedHostnames = new Set([
      'localhost',
      'localhost.localdomain',
      'ip6-localhost',
      'ip6-loopback',
      'metadata',
      'metadata.google.internal',
      'instance-data',
      '0.0.0.0',
    ]);

    if (
      blockedHostnames.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.arpa')
    ) {
      return {
        valid: false,
        code: 'SSRF_INTERNAL_HOSTNAME',
        reasonFa: 'ارسال وب‌هوک به میزبان‌های داخلی، لوکال‌هاست یا سرویس‌های متادیتا (SSRF Protection) مسدود شده است.',
        reasonEn: 'SSRF Protection: Localhost and internal hostnames are blocked.',
      };
    }

    if (net.isIP(hostname)) {
      if (isPrivateOrInternalIp(hostname)) {
        return {
          valid: false,
          code: 'SSRF_PRIVATE_IP',
          reasonFa: `ارسال درخواست به آدرس IP خصوصی یا رزروشده (${hostname}) به دلیل محافظت امنیتی SSRF مسدود است.`,
          reasonEn: `SSRF Protection: Private or reserved IP address (${hostname}) is blocked.`,
        };
      }
      return {
        valid: true,
        normalizedUrl: parsed.toString(),
        hostname,
        resolvedIps: [hostname],
      };
    }

    if (!options?.skipDnsLookup) {
      try {
        const records = await dns.promises.lookup(hostname, { all: true });
        if (!records || records.length === 0) {
          return {
            valid: false,
            code: 'DNS_RESOLUTION_EMPTY',
            reasonFa: `نام دامنه (${hostname}) به هیچ آدرس IP معتبری ترجمه نشد.`,
            reasonEn: `DNS lookup returned no records for ${hostname}.`,
          };
        }
        const resolvedIps = records.map((r) => r.address);
        for (const ip of resolvedIps) {
          if (isPrivateOrInternalIp(ip)) {
            return {
              valid: false,
              code: 'SSRF_DNS_REBINDING_PRIVATE_IP',
              reasonFa: `دامنه مقصد (${hostname}) به آدرس شبکه داخلی (${ip}) اشاره می‌کند و توسط سپر ضد SSRF مسدود شد.`,
              reasonEn: `SSRF Protection: Hostname ${hostname} resolved to internal/private IP ${ip}.`,
            };
          }
        }
        return {
          valid: true,
          normalizedUrl: parsed.toString(),
          hostname,
          resolvedIps,
        };
      } catch (err: any) {
        return {
          valid: false,
          code: 'DNS_LOOKUP_FAILED',
          reasonFa: `عدم امکان شناسایی DNS برای دامنه مقصد (${hostname}): ${err?.code || err?.message || 'خطای شبکه'}`,
          reasonEn: `DNS resolution failed for ${hostname}: ${err?.message || 'Unknown DNS error'}`,
        };
      }
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    hostname,
    resolvedIps: [],
  };
}

/**
 * Generates HMAC-SHA256 signature bound to timestamp and raw JSON payload
 * Canonical form: `${timestampSec}.${rawBody}`
 */
export function signWebhookPayload(rawBody: string, secret: string, timestampSec: number): string {
  const effectiveSecret = (secret || '').trim();
  if (!effectiveSecret) {
    throw new Error('Webhook HMAC secret is not configured');
  }
  const canonicalPayload = `${timestampSec}.${rawBody}`;
  const digest = crypto.createHmac('sha256', effectiveSecret).update(canonicalPayload, 'utf8').digest('hex');
  return `sha256=${digest}`;
}

/**
 * Verifies inbound/callback HMAC-SHA256 signature with constant-time comparison and anti-replay timestamp window
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signatureHeader?: string | null;
  secret?: string | null;
  timestampHeader?: string | number | null;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string } {
  const { rawBody, signatureHeader, secret, timestampHeader, toleranceSeconds = 300 } = params;
  if (!secret || !secret.trim()) {
    return { valid: false, reason: 'MISSING_SERVER_SECRET' };
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'MISSING_SIGNATURE_HEADER' };
  }
  if (timestampHeader === undefined || timestampHeader === null || timestampHeader === '') {
    return { valid: false, reason: 'MISSING_TIMESTAMP_HEADER' };
  }

  const tsNum = Number(timestampHeader);
  if (!Number.isFinite(tsNum) || tsNum <= 0) {
    return { valid: false, reason: 'INVALID_TIMESTAMP_HEADER' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > toleranceSeconds) {
    return { valid: false, reason: 'TIMESTAMP_OUTSIDE_TOLERANCE_REPLAY_BLOCKED' };
  }

  const expectedSig = signWebhookPayload(rawBody, secret.trim(), tsNum);
  const providedTrimmed = signatureHeader.trim();

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(providedTrimmed, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }

  const isMatch = crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!isMatch) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }

  return { valid: true };
}

/**
 * Recursively strips PII, credentials, and base64 blobs from payload data
 * to comply with strict data minimization principles.
 */
export function sanitizeWebhookPayloadData(input: any, depth = 0): any {
  if (depth > 6 || input === null || input === undefined) {
    return input;
  }
  if (typeof input === 'string') {
    if (input.startsWith('data:image/') || input.startsWith('data:application/')) {
      return '[REDACTED_BINARY_ATTACHMENT]';
    }
    if (input.length > 4000) {
      return `${input.slice(0, 4000)}...[TRUNCATED]`;
    }
    return input;
  }
  if (typeof input !== 'object') {
    return input;
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (Array.isArray(input)) {
    return input.slice(0, 50).map((item) => sanitizeWebhookPayloadData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');
    if (SENSITIVE_PII_KEYS.has(normalizedKey)) {
      continue;
    }
    sanitized[key] = sanitizeWebhookPayloadData(val, depth + 1);
  }
  return sanitized;
}

/**
 * Builds a standardized, versioned webhook event envelope compatible with n8n, Make, and Camunda 8
 */
export function buildStandardWebhookEnvelope(params: {
  eventType: WebhookEventType;
  data: Record<string, any>;
  idempotencyKey?: string;
  correlationKey?: string;
  moduleName?: string;
}) {
  const eventId = `evt_${crypto.randomUUID()}`;
  const occurredAt = new Date().toISOString();
  const sanitizedData = sanitizeWebhookPayloadData(params.data || {});

  const camundaMessageMap: Record<WebhookEventType, string> = {
    'incident.reported': 'msg_hse_incident_reported',
    'warning.issued': 'msg_hse_warning_issued',
    'permit.status_adjusted': 'msg_hse_permit_status_adjusted',
    'heat_stress.level_change': 'msg_hse_heat_stress_level_change',
    'system.test_ping': 'msg_hse_system_test_ping',
  };

  const correlationKey =
    params.correlationKey ||
    String(
      sanitizedData.incidentNumber ||
        sanitizedData.permitNumber ||
        sanitizedData.number ||
        sanitizedData.stationId ||
        sanitizedData.id ||
        eventId
    );

  const idempotencyKey =
    params.idempotencyKey ||
    `idem_${params.eventType}_${correlationKey}_${ sanHash(JSON.stringify(sanitizedData)) }`;

  return {
    schema_version: '1.0',
    event_id: eventId,
    idempotency_key: idempotencyKey,
    event_type: params.eventType,
    occurred_at: occurredAt,
    source: {
      system: 'HSECORE',
      module: params.moduleName || params.eventType.split('.')[0],
      environment: process.env.NODE_ENV || 'production',
    },
    automation_context: {
      compatible_engines: ['n8n', 'make', 'camunda8'],
      camunda8: {
        messageName: camundaMessageMap[params.eventType],
        correlationKey,
        variables: sanitizedData,
      },
    },
    data: sanitizedData,
  };
}

function sanHash(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Analyzes the HTTP response from the destination endpoint to prevent false-positive success reporting.
 * Simply receiving HTTP 200 (e.g., an HTML login page, SPA shell, or proxy challenge) is NOT treated as verified workflow execution.
 */
export function verifyEndpointResponse(params: {
  httpStatus: number;
  contentType: string | null;
  responseBody: string;
  redirectLocation?: string | null;
}): {
  status: WebhookDeliveryStatus;
  verifiedWorkflowAck: boolean;
  reasonFa: string;
  reasonEn: string;
  shouldRetry: boolean;
} {
  const { httpStatus, contentType, responseBody, redirectLocation } = params;
  const ct = (contentType || '').toLowerCase();
  const trimmedBody = (responseBody || '').trim();
  const lowerBody = trimmedBody.toLowerCase();

  // 1. Block Redirects (3xx) - prevents redirect to login page or SSRF redirect
  if (httpStatus >= 300 && httpStatus < 400) {
    return {
      status: 'FAILED',
      verifiedWorkflowAck: false,
      shouldRetry: false,
      reasonFa: `سرور مقصد به آدرس دیگری تغییر مسیر داد (HTTP ${httpStatus}${redirectLocation ? ` -> ${redirectLocation}` : ''}). وب‌هوک معتبر نباید Redirect انجام دهد.`,
      reasonEn: `Endpoint responded with HTTP ${httpStatus} Redirect. Webhook endpoints must accept POST directly without redirects.`,
    };
  }

  // 2. Transient Server Errors or Rate Limiting -> eligible for controlled retry
  if ([408, 429, 500, 502, 503, 504].includes(httpStatus)) {
    return {
      status: 'FAILED',
      verifiedWorkflowAck: false,
      shouldRetry: true,
      reasonFa: `خطای موقت در سرور مقصد (HTTP ${httpStatus}). واجد شرایط تلاش مجدد خودکار.`,
      reasonEn: `Transient endpoint failure (HTTP ${httpStatus}). Eligible for retry.`,
    };
  }

  // 3. Permanent Client Errors (4xx except 408/429) -> do not retry automatically
  if (httpStatus < 200 || httpStatus >= 400) {
    return {
      status: 'FAILED',
      verifiedWorkflowAck: false,
      shouldRetry: false,
      reasonFa: `درخواست توسط سرور مقصد رد شد (HTTP ${httpStatus}). لطفاً آدرس وب‌هوک، متد POST و دسترسی سرویس مقصد را بررسی کنید.`,
      reasonEn: `Endpoint rejected webhook with HTTP ${httpStatus}.`,
    };
  }

  // 4. HTTP 2xx received — Perform Anti-False-Positive Verification!
  // Check if the endpoint returned an HTML page (login portal, reverse proxy page, SPA fallback, Cloudflare challenge)
  if (
    ct.includes('text/html') ||
    ct.includes('application/xhtml+xml') ||
    lowerBody.startsWith('<!doctype html') ||
    lowerBody.startsWith('<html') ||
    lowerBody.includes('<title>sign in') ||
    lowerBody.includes('<title>login')
  ) {
    return {
      status: 'UNVERIFIED_RESPONSE',
      verifiedWorkflowAck: false,
      shouldRetry: false,
      reasonFa: `هشدار موفقیت کاذب: کد HTTP ${httpStatus} دریافت شد اما پاسخ از نوع صفحه وب (HTML) است و تأییدیه اجرای گردش‌کار (JSON/Webhook Ack) از n8n، Make یا Camunda دریافت نشد.`,
      reasonEn: `False-Positive Warning: Received HTTP ${httpStatus}, but Content-Type is HTML instead of a valid webhook/workflow acknowledgment.`,
    };
  }

  // Check if response is JSON and inspect for explicit error flags inside a 200 payload
  if (ct.includes('application/json') || (trimmedBody.startsWith('{') && trimmedBody.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmedBody);
      if (parsed && (parsed.error === true || parsed.success === false || parsed.status === 'error')) {
        return {
          status: 'UNVERIFIED_RESPONSE',
          verifiedWorkflowAck: false,
          shouldRetry: false,
          reasonFa: `سرور مقصد کد HTTP ${httpStatus} برگرداند اما در بدنه JSON خطای منطقی گزارش کرد: ${parsed.message || parsed.error || 'Workflow error'}`,
          reasonEn: `Endpoint returned HTTP ${httpStatus} with an error payload in JSON body.`,
        };
      }
      return {
        status: 'DELIVERED',
        verifiedWorkflowAck: true,
        shouldRetry: false,
        reasonFa: `تحویل و تأیید ساختاریافته گردش‌کار با موفقیت انجام شد (HTTP ${httpStatus} - JSON Verified).`,
        reasonEn: `Payload delivered and verified by structured JSON response (HTTP ${httpStatus}).`,
      };
    } catch {
      return {
        status: 'UNVERIFIED_RESPONSE',
        verifiedWorkflowAck: false,
        shouldRetry: false,
        reasonFa: `کد HTTP ${httpStatus} دریافت شد اما بدنه پاسخ JSON معتبر نیست.`,
        reasonEn: `Received HTTP ${httpStatus} with malformed JSON body.`,
      };
    }
  }

  // Make.com standard text response ("Accepted") or explicit plain-text webhook acknowledgment
  const recognizedTextAcks = ['accepted', 'ok', 'received', 'queued', 'webhook received', 'success'];
  if (
    httpStatus === 204 ||
    recognizedTextAcks.includes(lowerBody) ||
    (ct.includes('text/plain') && trimmedBody.length > 0 && trimmedBody.length <= 120 && !lowerBody.includes('<'))
  ) {
    return {
      status: 'DELIVERED',
      verifiedWorkflowAck: true,
      shouldRetry: false,
      reasonFa: `تحویل وب‌هوک و پذیرش توسط مقصد تأیید شد (HTTP ${httpStatus}${trimmedBody ? ` - "${trimmedBody.slice(0, 40)}"` : ''}).`,
      reasonEn: `Payload delivered and acknowledged by endpoint (HTTP ${httpStatus}).`,
    };
  }

  // Empty 200 response with no content-type or unrecognized format -> mark as UNVERIFIED_RESPONSE
  return {
    status: 'UNVERIFIED_RESPONSE',
    verifiedWorkflowAck: false,
    shouldRetry: false,
    reasonFa: `کد HTTP ${httpStatus} دریافت شد اما پاسخ فاقد تأییدیه صریح اجرای گردش‌کار (Empty/Unverified Body) است.`,
    reasonEn: `Received HTTP ${httpStatus} without an explicit workflow acknowledgment body.`,
  };
}

/**
 * Loads integration configuration from PostgreSQL (or synchronized cache)
 */
export async function getIntegrationConfigFromDb(): Promise<WebhookIntegrationConfig> {
  if (cachedIntegrationConfig) {
    return cachedIntegrationConfig;
  }

  const defaultConfig: WebhookIntegrationConfig = {
    weatherProvider: 'open-meteo',
    weatherStationUrl: 'https://api.met.no/weatherapi/locationforecast/2.0/compact',
    weatherSyncInterval: 15,
    smsProvider: 'kavenegar',
    smsApiKey: '',
    smsSenderNumber: '10008445',
    smsAlertHighHeat: true,
    smsAlertIncident: true,
    smsAlertPermitExpiry: false,
    webhookEnabled: false,
    webhookUrl: '',
    webhookSecret: generateWebhookSecret(),
    webhookOnHeat: true,
    webhookOnPermit: true,
    webhookOnWarning: true,
    webhookOnIncident: true,
    erpSyncEnabled: false,
    erpEndpointUrl: '',
    erpSyncSchedule: '02:00',
    aiEngineEnabled: true,
    aiProvider: 'gemini',
    aiModelName: 'gemini-2.5-flash',
    aiApiKey: '',
  };

  try {
    const records = await withDbRetry(() =>
      db.select().from(systemSettings).where(eq(systemSettings.key, INTEGRATION_CONFIG_KEY))
    );
    if (records.length > 0 && records[0].value && typeof records[0].value === 'object') {
      const dbVal = records[0].value as Partial<WebhookIntegrationConfig>;
      // Replace legacy hardcoded sample secret if found
      const secret =
        !dbVal.webhookSecret || dbVal.webhookSecret === 'whsec_hse_94029482019482'
          ? defaultConfig.webhookSecret
          : dbVal.webhookSecret;
      cachedIntegrationConfig = {
        ...defaultConfig,
        ...dbVal,
        webhookSecret: secret,
      };
      return cachedIntegrationConfig;
    }
  } catch (err: any) {
    logger.warn('Failed to load integration config from DB, using runtime default', { error: err?.message });
  }

  cachedIntegrationConfig = defaultConfig;
  return cachedIntegrationConfig;
}

/**
 * Returns a copy of the integration config with sensitive keys masked for safe client consumption
 */
export function maskIntegrationConfigForClient(config: any): any {
  if (!config || typeof config !== 'object') return config;
  return {
    ...config,
    webhookSecret: config.webhookSecret ? maskSecretValue(config.webhookSecret) : '',
    webhookSecretConfigured: Boolean(config.webhookSecret && String(config.webhookSecret).trim().length >= 12),
    smsApiKey: config.smsApiKey ? maskSecretValue(config.smsApiKey) : '',
    aiApiKey: config.aiApiKey ? maskSecretValue(config.aiApiKey) : '',
  };
}

/**
 * Saves integration configuration to PostgreSQL while preserving existing secrets if masked placeholders were submitted
 */
export async function saveIntegrationConfigToDb(
  incoming: Partial<WebhookIntegrationConfig>,
  options?: { allowInternalTestServer?: boolean }
): Promise<{
  config: WebhookIntegrationConfig;
  validation?: UrlValidationResult;
}> {
  const current = await getIntegrationConfigFromDb();

  // Preserve real secrets if the client sent back the masked placeholder
  const resolvedWebhookSecret =
    incoming.webhookSecret === undefined || isMaskedSecretPlaceholder(incoming.webhookSecret)
      ? current.webhookSecret || generateWebhookSecret()
      : incoming.webhookSecret.trim() || generateWebhookSecret();

  const resolvedSmsKey =
    incoming.smsApiKey === undefined || isMaskedSecretPlaceholder(incoming.smsApiKey)
      ? current.smsApiKey || ''
      : incoming.smsApiKey.trim();

  const resolvedAiKey =
    incoming.aiApiKey === undefined || isMaskedSecretPlaceholder(incoming.aiApiKey)
      ? current.aiApiKey || ''
      : incoming.aiApiKey.trim();

  const candidateUrl = incoming.webhookUrl !== undefined ? String(incoming.webhookUrl).trim() : current.webhookUrl;

  let urlValidation: UrlValidationResult | undefined;
  if (candidateUrl) {
    urlValidation = await validateWebhookTargetUrl(candidateUrl, {
      skipDnsLookup: true, // Syntax + IP literal + hostname check on save; full DNS lookup runs on dispatch
      allowInternalTestServer: options?.allowInternalTestServer,
    });
    if (!urlValidation.valid) {
      const err: any = new Error(urlValidation.reasonFa || 'آدرس وب‌هوک نامعتبر است.');
      err.statusCode = 400;
      err.code = urlValidation.code;
      throw err;
    }
  }

  const merged: WebhookIntegrationConfig = {
    ...current,
    ...incoming,
    webhookUrl: candidateUrl,
    webhookSecret: resolvedWebhookSecret,
    smsApiKey: resolvedSmsKey,
    aiApiKey: resolvedAiKey,
    updatedAt: new Date().toISOString(),
  };

  cachedIntegrationConfig = merged;

  await withDbRetry(() =>
    db
      .insert(systemSettings)
      .values({
        key: INTEGRATION_CONFIG_KEY,
        value: merged,
        description: 'HSE Webhook & External Automation Integration Configuration',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: merged,
          updatedAt: new Date(),
        },
      })
  );

  const maskedForBroadcast = maskIntegrationConfigForClient(merged);
  broadcastDataMutation('settings', 'update', { key: INTEGRATION_CONFIG_KEY, value: maskedForBroadcast });
  broadcastDataMutation(INTEGRATION_CONFIG_KEY, 'update', maskedForBroadcast);

  return { config: merged, validation: urlValidation };
}

/**
 * Updates the in-memory cache when settings are updated via generic settings routes
 */
export function syncIntegrationConfigCache(rawValue: any) {
  if (rawValue && typeof rawValue === 'object') {
    cachedIntegrationConfig = {
      ...(cachedIntegrationConfig || ({} as any)),
      ...rawValue,
    };
  }
}

/**
 * Loads persistent webhook delivery logs from PostgreSQL
 */
export async function getWebhookDeliveryLogs(limit = 50): Promise<WebhookDeliveryLog[]> {
  if (cachedDeliveryLogs) {
    return cachedDeliveryLogs.slice(0, limit);
  }
  try {
    const records = await withDbRetry(() =>
      db.select().from(systemSettings).where(eq(systemSettings.key, WEBHOOK_DELIVERY_LOGS_KEY))
    );
    if (records.length > 0 && Array.isArray(records[0].value)) {
      cachedDeliveryLogs = records[0].value as WebhookDeliveryLog[];
      return cachedDeliveryLogs.slice(0, limit);
    }
  } catch (err: any) {
    logger.warn('Failed to load webhook delivery logs from DB', { error: err?.message });
  }
  cachedDeliveryLogs = [];
  return [];
}

/**
 * Persists a webhook delivery log entry in PostgreSQL and updates the cache
 */
async function recordWebhookDeliveryLog(entry: WebhookDeliveryLog): Promise<void> {
  const existing = await getWebhookDeliveryLogs(MAX_STORED_DELIVERY_LOGS);
  const filtered = existing.filter((item) => item.id !== entry.id);
  const updated = [entry, ...filtered].slice(0, MAX_STORED_DELIVERY_LOGS);
  cachedDeliveryLogs = updated;

  try {
    await withDbRetry(() =>
      db
        .insert(systemSettings)
        .values({
          key: WEBHOOK_DELIVERY_LOGS_KEY,
          value: updated,
          description: 'Persistent audit trail of outbound HSE webhook deliveries',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: updated,
            updatedAt: new Date(),
          },
        })
    );
    broadcastDataMutation('webhook_logs', 'update', entry);
  } catch (err: any) {
    logger.warn('Failed to persist webhook delivery log to DB', { error: err?.message });
  }
}

/**
 * Clears webhook delivery logs
 */
export async function clearWebhookDeliveryLogs(): Promise<void> {
  cachedDeliveryLogs = [];
  try {
    await withDbRetry(() =>
      db
        .insert(systemSettings)
        .values({
          key: WEBHOOK_DELIVERY_LOGS_KEY,
          value: [],
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: [], updatedAt: new Date() },
        })
    );
  } catch (err: any) {
    logger.warn('Failed to clear webhook delivery logs in DB', { error: err?.message });
  }
}

/**
 * Core HTTP delivery executor with SSRF guard, HMAC signing, timeout, and controlled exponential backoff retries
 */
export async function executeWebhookDelivery(params: {
  eventType: WebhookEventType;
  data: Record<string, any>;
  targetUrl?: string;
  secret?: string;
  idempotencyKey?: string;
  correlationKey?: string;
  moduleName?: string;
  triggeredBy?: string;
  maxAttempts?: number;
  forceDispatch?: boolean;
  allowInternalTestServer?: boolean;
  existingDeliveryId?: string;
}): Promise<WebhookDeliveryLog> {
  const config = await getIntegrationConfigFromDb();
  const targetUrl = (params.targetUrl ?? config.webhookUrl ?? '').trim();
  const secret = (params.secret ?? config.webhookSecret ?? '').trim() || generateWebhookSecret();
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const envelope = buildStandardWebhookEnvelope({
    eventType: params.eventType,
    data: params.data,
    idempotencyKey: params.idempotencyKey,
    correlationKey: params.correlationKey,
    moduleName: params.moduleName,
  });

  const deliveryId = params.existingDeliveryId || `whd_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  // Check idempotency to prevent duplicate delivery of identical events within 10 minutes
  if (!params.forceDispatch) {
    const prev = deliveredIdempotencyKeys.get(envelope.idempotency_key);
    if (prev && Date.now() - prev.timestamp < 10 * 60 * 1000) {
      const existingLogs = await getWebhookDeliveryLogs(MAX_STORED_DELIVERY_LOGS);
      const found = existingLogs.find((l) => l.id === prev.deliveryId);
      if (found) {
        return found;
      }
    }
  }

  // Validate target URL & SSRF before making any network connection
  const urlValidation = await validateWebhookTargetUrl(targetUrl, {
    allowInternalTestServer: params.allowInternalTestServer,
  });

  const rawBody = JSON.stringify(envelope);
  const initialTimestampSec = Math.floor(Date.now() / 1000);
  const initialSignature = signWebhookPayload(rawBody, secret, initialTimestampSec);

  if (!urlValidation.valid) {
    const failedLog: WebhookDeliveryLog = {
      id: deliveryId,
      eventId: envelope.event_id,
      idempotencyKey: envelope.idempotency_key,
      eventType: params.eventType,
      targetUrl: targetUrl || '(آدرس تنظیم نشده)',
      status: 'FAILED',
      verifiedWorkflowAck: false,
      verificationReason: urlValidation.reasonFa || 'آدرس مقصد نامعتبر یا مسدود شده توسط سپر امنیتی SSRF.',
      httpStatus: null,
      responseContentType: null,
      latencyMs: 0,
      attemptCount: 1,
      maxAttempts: 1,
      signatureHeader: initialSignature,
      timestampHeader: String(initialTimestampSec),
      requestPayload: envelope,
      responseSnippet: '',
      errorMessage: urlValidation.reasonFa,
      triggeredBy: params.triggeredBy || 'system',
      createdAt,
      completedAt: new Date().toISOString(),
    };
    await recordWebhookDeliveryLog(failedLog);
    return failedLog;
  }

  let attempt = 0;
  let lastLog: WebhookDeliveryLog | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const timestampSec = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(rawBody, secret, timestampSec);
    const startMs = Date.now();

    try {
      const response = await fetch(urlValidation.normalizedUrl!, {
        method: 'POST',
        redirect: 'manual', // Never follow redirects automatically (SSRF & login-redirect protection)
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json, text/plain;q=0.9',
          'User-Agent': 'HSECORE-Webhook-Engine/1.0',
          'X-HSE-Event': params.eventType,
          'X-HSE-Delivery-Id': deliveryId,
          'X-HSE-Event-Id': envelope.event_id,
          'X-HSE-Idempotency-Key': envelope.idempotency_key,
          'X-HSE-Timestamp': String(timestampSec),
          'X-HSE-Signature-256': signature,
          'X-HSE-Schema-Version': envelope.schema_version,
        },
        body: rawBody,
      });

      const latencyMs = Date.now() - startMs;
      const contentType = response.headers.get('content-type');
      const redirectLocation = response.headers.get('location');
      const rawResponseText = await response.text().catch(() => '');
      const responseSnippet = rawResponseText.slice(0, 600);

      const verification = verifyEndpointResponse({
        httpStatus: response.status,
        contentType,
        responseBody: rawResponseText,
        redirectLocation,
      });

      const isFinalAttempt = attempt >= maxAttempts || !verification.shouldRetry;
      const finalStatus: WebhookDeliveryStatus =
        !isFinalAttempt && verification.shouldRetry ? 'RETRY_SCHEDULED' : verification.status;

      lastLog = {
        id: deliveryId,
        eventId: envelope.event_id,
        idempotencyKey: envelope.idempotency_key,
        eventType: params.eventType,
        targetUrl: urlValidation.normalizedUrl!,
        status: finalStatus,
        verifiedWorkflowAck: verification.verifiedWorkflowAck,
        verificationReason: verification.reasonFa,
        httpStatus: response.status,
        responseContentType: contentType,
        latencyMs,
        attemptCount: attempt,
        maxAttempts,
        signatureHeader: signature,
        timestampHeader: String(timestampSec),
        requestPayload: envelope,
        responseSnippet,
        errorMessage:
          finalStatus === 'FAILED' || finalStatus === 'UNVERIFIED_RESPONSE'
            ? verification.reasonFa
            : undefined,
        triggeredBy: params.triggeredBy || 'system',
        createdAt,
        completedAt: new Date().toISOString(),
      };

      await recordWebhookDeliveryLog(lastLog);

      if (verification.status === 'DELIVERED') {
        deliveredIdempotencyKeys.set(envelope.idempotency_key, {
          deliveryId,
          timestamp: Date.now(),
        });
        return lastLog;
      }

      if (isFinalAttempt) {
        return lastLog;
      }
    } catch (networkErr: any) {
      const latencyMs = Date.now() - startMs;
      const isTimeout =
        networkErr?.name === 'TimeoutError' ||
        networkErr?.name === 'AbortError' ||
        String(networkErr?.message || '').toLowerCase().includes('timeout');

      const errorReasonFa = isTimeout
        ? `مهلت زمانی پاسخگویی سرور مقصد به پایان رسید (Timeout > ${WEBHOOK_TIMEOUT_MS / 1000}s).`
        : `خطای ارتباط شبکه با سرور مقصد: ${networkErr?.message || 'Network unreachable'}`;

      const isFinalAttempt = attempt >= maxAttempts;

      lastLog = {
        id: deliveryId,
        eventId: envelope.event_id,
        idempotencyKey: envelope.idempotency_key,
        eventType: params.eventType,
        targetUrl: urlValidation.normalizedUrl!,
        status: isFinalAttempt ? 'FAILED' : 'RETRY_SCHEDULED',
        verifiedWorkflowAck: false,
        verificationReason: errorReasonFa,
        httpStatus: null,
        responseContentType: null,
        latencyMs,
        attemptCount: attempt,
        maxAttempts,
        signatureHeader: signature,
        timestampHeader: String(timestampSec),
        requestPayload: envelope,
        responseSnippet: '',
        errorMessage: errorReasonFa,
        triggeredBy: params.triggeredBy || 'system',
        createdAt,
        completedAt: new Date().toISOString(),
      };

      await recordWebhookDeliveryLog(lastLog);

      if (isFinalAttempt) {
        return lastLog;
      }
    }

    // Controlled Exponential Backoff before next retry (e.g., 1.2s, 2.5s)
    const backoffDelayMs = Math.min(1200 * Math.pow(2, attempt - 1), 5000);
    await new Promise((resolve) => setTimeout(resolve, backoffDelayMs));
  }

  return lastLog!;
}

/**
 * Checks whether a specific domain event is enabled in `hse_integration_config` and dispatches it asynchronously
 */
export async function dispatchDomainWebhookEvent(params: {
  eventType: Exclude<WebhookEventType, 'system.test_ping'>;
  data: Record<string, any>;
  idempotencyKey?: string;
  correlationKey?: string;
  moduleName?: string;
  triggeredBy?: string;
}): Promise<WebhookDeliveryLog | null> {
  try {
    // 1. Stage in the internal Transactional Outbox for local rule processing
    try {
      await publishDomainEvent({
        eventType: params.eventType,
        sourceModule: params.moduleName || 'system',
        correlationKey: params.correlationKey,
        idempotencyKey: params.idempotencyKey,
        triggeredBy: params.triggeredBy,
        payload: params.data,
      });
    } catch (publishErr: any) {
      logger.warn('Failed to publish event to internal automation outbox', {
        eventType: params.eventType,
        error: publishErr?.message,
      });
    }

    // 2. Dispatch to external webhook if configured and enabled
    const config = await getIntegrationConfigFromDb();
    if (!config.webhookEnabled || !config.webhookUrl || !config.webhookUrl.trim()) {
      return null;
    }

    const eventToggleMap: Record<Exclude<WebhookEventType, 'system.test_ping'>, boolean> = {
      'incident.reported': Boolean(config.webhookOnIncident),
      'warning.issued': Boolean(config.webhookOnWarning),
      'permit.status_adjusted': Boolean(config.webhookOnPermit),
      'heat_stress.level_change': Boolean(config.webhookOnHeat),
    };

    if (!eventToggleMap[params.eventType]) {
      return null;
    }

    return await executeWebhookDelivery({
      eventType: params.eventType,
      data: params.data,
      idempotencyKey: params.idempotencyKey,
      correlationKey: params.correlationKey,
      moduleName: params.moduleName,
      triggeredBy: params.triggeredBy,
    });
  } catch (err: any) {
    logger.warn('Failed to dispatch domain webhook event', {
      eventType: params.eventType,
      error: err?.message,
    });
    return null;
  }
}

/**
 * Evaluates WBGT Heat Stress risk level and triggers `heat_stress.level_change` when the risk zone changes
 * or when an explicit high-risk station measurement is logged.
 */
export async function evaluateAndDispatchHeatStressWebhook(params: {
  stationId: string;
  locationName?: string;
  wbgt: number;
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  riskLevel: string;
  provider?: string;
  measuredAt?: string;
  forceOnRecord?: boolean;
}): Promise<WebhookDeliveryLog | null> {
  const key = params.stationId || params.locationName || 'default_site';
  const normalizedRisk = String(params.riskLevel || 'LOW').toUpperCase();
  const previousRisk = lastHeatStressLevelByLocation.get(key);

  lastHeatStressLevelByLocation.set(key, normalizedRisk);

  const hasChanged = previousRisk !== undefined && previousRisk !== normalizedRisk;
  const isCriticalOrHighInitial =
    previousRisk === undefined && (normalizedRisk === 'HIGH' || normalizedRisk === 'CRITICAL' || normalizedRisk === 'EXTREME' || params.wbgt >= 28);

  if (!hasChanged && !isCriticalOrHighInitial && !params.forceOnRecord) {
    return null;
  }

  return dispatchDomainWebhookEvent({
    eventType: 'heat_stress.level_change',
    moduleName: 'heat_stress_wbgt',
    correlationKey: `WBGT-${key}`,
    idempotencyKey: `idem_heat_${key}_${previousRisk || 'INIT'}_to_${normalizedRisk}_${Math.floor(Date.now() / 60000)}`,
    data: {
      stationId: key,
      locationName: params.locationName || key,
      previousRiskLevel: previousRisk || 'INITIAL_READ',
      currentRiskLevel: normalizedRisk,
      wbgtCelsius: Number(params.wbgt.toFixed(1)),
      temperatureCelsius: params.temperature,
      humidityPercent: params.humidity,
      windSpeedMs: params.windSpeed,
      weatherProvider: params.provider || 'primary_station',
      measuredAt: params.measuredAt || new Date().toISOString(),
      recommendedActionFa:
        params.wbgt >= 32
          ? 'توقف فوری کارهای سنگین در فضای باز و اجرای پروتکل اضطراری تنش گرمایی'
          : params.wbgt >= 30
            ? 'کاهش شیفت کاری به ۲۵٪ کار / ۷۵٪ استراحت در سایه و تأمین آب خنک'
            : params.wbgt >= 28
              ? 'اعمال چرخش شیفت ۵۰٪ کار / ۵۰٪ استراحت و پایش مستمر پرسنل'
              : 'شرایط ایمن یا نیازمند پایش دوره‌ای',
    },
  });
}

/**
 * Retries a previously recorded webhook delivery by its ID
 */
export async function retryWebhookDeliveryById(
  deliveryId: string,
  triggeredBy = 'manual_admin_retry',
  options?: { allowInternalTestServer?: boolean }
): Promise<WebhookDeliveryLog> {
  const logs = await getWebhookDeliveryLogs(MAX_STORED_DELIVERY_LOGS);
  const target = logs.find((item) => item.id === deliveryId);
  if (!target) {
    const err: any = new Error('رکورد سابقه ارسال وب‌هوک یافت نشد.');
    err.statusCode = 404;
    throw err;
  }

  return executeWebhookDelivery({
    eventType: target.eventType,
    data: target.requestPayload?.data || {},
    idempotencyKey: target.idempotencyKey,
    correlationKey: target.requestPayload?.automation_context?.camunda8?.correlationKey,
    moduleName: target.requestPayload?.source?.module,
    triggeredBy,
    maxAttempts: 2,
    forceDispatch: true,
    existingDeliveryId: target.id,
    allowInternalTestServer: options?.allowInternalTestServer,
  });
}
