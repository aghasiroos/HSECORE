/**
 * Core Configuration Service
 * Centrally validates and provides environment settings with strict security enforcement.
 */
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  appUrl: string;
  isProd: boolean;
  aiEngine: {
    enabled: boolean;
    url: string;
    defaultChatModel: string;
    defaultEmbedModel: string;
    maxConcurrency: number;
    timeoutMs: number;
    contextTokens: number;
    maxQueueLength: number;
    modelPullTimeoutMs: number;
    allowCloudFallback: boolean;
  };
  database: {
    host?: string;
    user?: string;
    password?: string;
    name?: string;
    port: number;
    ssl: boolean;
    sslCa?: string;
  };
  weather: {
    forecaApiKey?: string;
    forecaApiToken?: string;
    forecaUser?: string;
    forecaPassword?: string;
    accuweatherKey?: string;
    irimoKey?: string;
  };
  security: {
    jwtSecret: string;
    tokenExpiry: string;
    corsOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMax: number;
    authRateLimitWindowMs: number;
    authRateLimitMax: number;
    maxUploadSizeBytes: number;
    uploadDir: string;
  };
}

const env = (process.env.NODE_ENV === 'production' ? 'production' : 'development') as 'development' | 'production' | 'test';
const isProd = env === 'production';

// -----------------------------------------------------------------------------
// 1. JWT Security Validation
// - JWT_SECRET must ONLY come from the environment.
// - In production, missing or weak JWT_SECRET MUST trigger safe shutdown.
// - No hardcoded fallback secrets.
// -----------------------------------------------------------------------------
const rawJwtSecret = process.env.JWT_SECRET?.trim() || '';

function getDevJwtSecret(): string {
  const secretFile = path.resolve(process.cwd(), '.dev-jwt-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf-8').trim();
      if (saved && saved.length >= 32) return saved;
    }
    const newSecret = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretFile, newSecret, 'utf-8');
    } catch {}
    return newSecret;
  } catch {
    // Never fall back to a repository-wide fixed signing key, even in development.
    // A fresh process-local secret is safer than a predictable shared fallback.
    return crypto.randomBytes(32).toString('hex');
  }
}

if (isProd) {
  if (!rawJwtSecret || rawJwtSecret.length < 32) {
    console.error(
      '\n=======================================================================\n' +
      '[FATAL SECURITY ERROR] In production, JWT_SECRET environment variable\n' +
      'MUST be set and contain at least 32 characters.\n' +
      'Application safe shutdown initiated to prevent unauthorized access.\n' +
      '=======================================================================\n'
    );
    process.exit(1);
  }

  const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    process.env.PG_URL
  );
  const rawSqlHost = (process.env.SQL_HOST || process.env.PGHOST || '').trim();
  const isUnixSocket = rawSqlHost.startsWith('/');
  const rawSqlUser = (process.env.SQL_USER || process.env.PGUSER || '').trim();
  const rawSqlPassword = process.env.SQL_PASSWORD || process.env.PGPASSWORD || '';
  const rawSqlDb = (process.env.SQL_DB_NAME || process.env.PGDATABASE || '').trim();

  if (!hasDatabaseUrl && !isUnixSocket) {
    if (!rawSqlHost || !rawSqlUser || !rawSqlPassword || !rawSqlDb) {
      console.error(
        '\n=======================================================================\n' +
        '[FATAL DATABASE CONFIG ERROR] In production, SQL_HOST, SQL_USER,\n' +
        'SQL_PASSWORD, and SQL_DB_NAME environment variables MUST be explicitly set.\n' +
        'Application safe shutdown initiated to prevent insecure DB fallback.\n' +
        '=======================================================================\n'
      );
      process.exit(1);
    }
    if (rawSqlPassword === 'hse_secure_password_2026') {
      console.error(
        '\n=======================================================================\n' +
        '[FATAL SECURITY ERROR] Default placeholder password (hse_secure_password_2026)\n' +
        'is strictly prohibited in production. Set a strong SQL_PASSWORD in .env.\n' +
        '=======================================================================\n'
      );
      process.exit(1);
    }
  }
}

const jwtSecret = rawJwtSecret || (isProd ? '' : getDevJwtSecret());

// -----------------------------------------------------------------------------
// 2. CORS Whitelist Validation (Deployment-Agnostic)
// - Whitelist parsed strictly from Runtime Environment (CORS_ORIGINS / APP_URL).
// - No hardcoded localhost, IP, or cloud domains.
// - Wildcards (*) are strictly banned for security.
// - Same-Origin requests are handled dynamically in middleware without static config.
// -----------------------------------------------------------------------------
function resolveCorsOrigins(rawEnvOrigins?: string, appUrl?: string): string[] {
  const allowedOrigins: string[] = [];

  if (rawEnvOrigins && rawEnvOrigins.trim()) {
    const parsed = rawEnvOrigins
      .split(',')
      .map(o => o.trim().replace(/\/$/, ''))
      .filter(o => o.length > 0 && o !== '*' && !o.includes('*')); // Strictly disallow wildcards
    allowedOrigins.push(...parsed);
  }

  if (appUrl && appUrl.trim()) {
    const cleanAppUrl = appUrl.trim().replace(/\/$/, '');
    if (cleanAppUrl && cleanAppUrl !== '*' && !cleanAppUrl.includes('*') && !allowedOrigins.includes(cleanAppUrl)) {
      allowedOrigins.push(cleanAppUrl);
    }
  }

  return allowedOrigins;
}

export const config: AppConfig = {
  env,
  port: Number(process.env.PORT) || 3000,
  host: '0.0.0.0',
  appUrl: process.env.APP_URL || '',
  isProd,
  aiEngine: {
    enabled: process.env.AI_ENGINE_ENABLED === 'true' || process.env.AI_ENGINE_ENABLED !== 'false',
    url: (process.env.AI_ENGINE_URL || 'http://hse-ai-engine:11434').trim().replace(/\/$/, ''),
    defaultChatModel: process.env.AI_DEFAULT_CHAT_MODEL || 'qwen2.5:1.7b',
    defaultEmbedModel: process.env.AI_DEFAULT_EMBED_MODEL || 'bge-m3',
    maxConcurrency: Number(process.env.AI_MAX_CONCURRENCY) || 1,
    // CPU-only inference on the 8GB VPS needs a realistic generation window.
    timeoutMs: Math.min(Math.max(Number(process.env.AI_REQUEST_TIMEOUT_MS) || 180000, 30000), 600000),
    contextTokens: Math.min(Math.max(Number(process.env.AI_CONTEXT_TOKENS) || 4096, 1024), 16384),
    maxQueueLength: Math.min(Math.max(Number(process.env.AI_MAX_QUEUE_LENGTH) || 10, 1), 50),
    modelPullTimeoutMs: Math.min(Math.max(Number(process.env.AI_MODEL_PULL_TIMEOUT_MS) || 30 * 60 * 1000, 60 * 1000), 60 * 60 * 1000),
    // Cloud processing is opt-in; organization data remains local by default.
    allowCloudFallback: process.env.AI_CLOUD_FALLBACK_ENABLED === 'true',
  },
  database: {
    host: process.env.SQL_HOST || undefined,
    user: process.env.SQL_USER || undefined,
    password: process.env.SQL_PASSWORD || undefined,
    name: process.env.SQL_DB_NAME || 'hsedb',
    port: Number(process.env.SQL_PORT) || 5432,
    ssl: process.env.SQL_SSL === 'true' || process.env.PGSSLMODE === 'require',
    sslCa: process.env.SQL_SSL_CA || process.env.PGSSLROOTCERT || undefined,
  },
  weather: {
    forecaApiKey: process.env.FORECA_API_KEY || undefined,
    forecaApiToken: process.env.FORECA_API_TOKEN || undefined,
    forecaUser: process.env.FORECA_USER || undefined,
    forecaPassword: process.env.FORECA_PASSWORD || undefined,
    accuweatherKey: process.env.ACCUWEATHER_API_KEY || undefined,
    irimoKey: process.env.IRIMO_API_KEY || undefined,
  },
  security: {
    jwtSecret,
    tokenExpiry: process.env.JWT_EXPIRY || '8h',
    corsOrigins: resolveCorsOrigins(process.env.CORS_ORIGINS, process.env.APP_URL),
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 20000, // High capacity for SPA and dashboard analytics
    authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10, // 10 attempts per 15 mins for auth
    maxUploadSizeBytes: 50 * 1024 * 1024, // 50MB
    uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
  },
};
