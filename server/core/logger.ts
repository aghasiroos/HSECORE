/**
 * Central Structured Logging Service
 * Provides standardized JSON/Console logs, correlation ID tracking,
 * and automatic redaction of sensitive credentials.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'sql_password',
  'sql_admin_password',
  'pgpassword',
  'default_admin_password',
  'token',
  'secret',
  'jwt_secret',
  'authorization',
  'apikey',
  'gemini_api_key',
  'foreca_api_key',
  'foreca_api_token',
  'database_url',
  'postgres_url',
  'postgresql_url',
  'pg_url',
  'cookie',
]);

function isSensitiveKeyName(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lower)) return true;
  return (
    lower.includes('password') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('apikey') ||
    lower.includes('api_key') ||
    lower.includes('private_key')
  );
}

export function sanitizeLogString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  let out = str
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)([^@\s]+)(@)/gi, '$1***REDACTED***$3')
    .replace(/((?:SQL_PASSWORD|SQL_ADMIN_PASSWORD|PGPASSWORD|JWT_SECRET|PASSWORD)\s*=\s*)([^\s&"']+)/gi, '$1***REDACTED***');
  const envPw = process.env.SQL_PASSWORD;
  if (envPw && envPw.length >= 4 && out.includes(envPw)) {
    out = out.split(envPw).join('***REDACTED***');
  }
  return out;
}

export function redactSensitive(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeLogString(obj);
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeLogString(obj.message),
      stack: obj.stack ? sanitizeLogString(obj.stack) : undefined,
    };
  }
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKeyName(key)) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'string') {
      result[key] = sanitizeLogString(value);
    } else if (typeof value === 'object') {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class Logger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  private formatMessage(level: string, message: string, meta?: any, correlationId?: string) {
    const timestamp = new Date().toISOString();
    const logObj: Record<string, any> = {
      timestamp,
      level,
      context: this.context,
      message: sanitizeLogString(message),
    };

    if (correlationId) {
      logObj.correlationId = correlationId;
    }

    if (meta !== undefined) {
      logObj.meta = redactSensitive(meta);
    }

    return logObj;
  }

  info(message: string, meta?: any, correlationId?: string) {
    const formatted = this.formatMessage('INFO', message, meta, correlationId);
    console.log(`[${formatted.timestamp}] [INFO] [${this.context}] ${formatted.message}`, meta ? JSON.stringify(formatted.meta) : '');
  }

  warn(message: string, meta?: any, correlationId?: string) {
    const formatted = this.formatMessage('WARN', message, meta, correlationId);
    console.warn(`[${formatted.timestamp}] [WARN] [${this.context}] ${formatted.message}`, meta ? JSON.stringify(formatted.meta) : '');
  }

  error(message: string, error?: any, correlationId?: string) {
    const formatted = this.formatMessage('ERROR', message, error, correlationId);
    const errOut = formatted.meta
      ? typeof formatted.meta === 'string'
        ? formatted.meta
        : JSON.stringify(formatted.meta)
      : '';
    console.error(`[${formatted.timestamp}] [ERROR] [${this.context}] ${formatted.message}`, errOut);
  }

  debug(message: string, meta?: any, correlationId?: string) {
    if (
      process.env.DEBUG === 'true' ||
      process.env.LOG_LEVEL?.toLowerCase() === 'debug' ||
      process.env.DEBUG_LOGS === 'true'
    ) {
      const formatted = this.formatMessage('DEBUG', message, meta, correlationId);
      console.debug(`[${formatted.timestamp}] [DEBUG] [${this.context}] ${formatted.message}`, meta ? JSON.stringify(formatted.meta) : '');
    }
  }
}

export const logger = new Logger('System');
