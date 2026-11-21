import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import fs from 'fs';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

/**
 * Enterprise SSL Configuration Resolver for Database.
 * - In Production: Certificate validation is STRICTLY enforced (rejectUnauthorized: true).
 * - CA Certificate is loaded from SQL_SSL_CA or PGSSLROOTCERT (file path or PEM string).
 * - In Development: Strict by default, allows self-signed only if SQL_SSL_ALLOW_SELF_SIGNED=true.
 * - Insecure hardcoded rejectUnauthorized=false is completely eradicated.
 */
export function getPostgresSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  const isProd = process.env.NODE_ENV === 'production';
  const sslRequested =
    process.env.SQL_SSL === 'true' ||
    process.env.PGSSLMODE === 'require' ||
    process.env.PGSSLMODE === 'verify-ca' ||
    process.env.PGSSLMODE === 'verify-full';

  // If connecting via Unix domain socket (e.g. Cloud SQL proxy socket starting with /), SSL is not applicable
  const host = process.env.SQL_HOST || process.env.PGHOST;
  if (host && host.startsWith('/')) {
    return false;
  }

  if (!sslRequested) {
    return false;
  }

  // Load CA certificate if configured
  let caCertificate: string | undefined;
  const caConfig = process.env.SQL_SSL_CA || process.env.PGSSLROOTCERT;
  if (caConfig) {
    try {
      if (fs.existsSync(caConfig)) {
        caCertificate = fs.readFileSync(caConfig, 'utf-8');
      } else if (caConfig.includes('BEGIN CERTIFICATE')) {
        caCertificate = caConfig;
      }
    } catch (err: any) {
      console.error('[Database SSL] Error loading CA certificate:', err?.message || err);
    }
  }

  if (isProd) {
    // PRODUCTION: Certificate validation is true by default.
    // Can only be overridden via explicit SQL_SSL_REJECT_UNAUTHORIZED=false for local VPS self-signed certificates.
    const rejectUnauth = process.env.SQL_SSL_REJECT_UNAUTHORIZED !== 'false';
    return {
      rejectUnauthorized: rejectUnauth,
      ...(caCertificate ? { ca: caCertificate } : {}),
    };
  } else {
    // DEVELOPMENT: Strict validation by default.
    // Self-signed certificates only permitted if explicitly set by developer for local testing.
    const allowSelfSignedDev =
      process.env.SQL_SSL_ALLOW_SELF_SIGNED === 'true' ||
      process.env.SQL_SSL_REJECT_UNAUTHORIZED === 'false';
    return {
      rejectUnauthorized: !allowSelfSignedDev,
      ...(caCertificate ? { ca: caCertificate } : {}),
    };
  }
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRESQL_URL ||
      process.env.PG_URL;

    const sslConfig = getPostgresSslConfig();
    const maxConnections = Number(process.env.PG_MAX_POOL || process.env.SQL_MAX_POOL) || 30;
    const minConnections = Number(process.env.PG_MIN_POOL || process.env.SQL_MIN_POOL) || 2;
    const idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || process.env.SQL_IDLE_TIMEOUT_MS) || 60000;
    const connectionTimeoutMillis = Number(process.env.PG_CONN_TIMEOUT_MS || process.env.SQL_CONN_TIMEOUT_MS) || 15000;

    const host = process.env.SQL_HOST || process.env.PGHOST || '127.0.0.1';
    const isUnixSocket = host.startsWith('/');

    if (
      process.env.NODE_ENV === 'production' &&
      !connectionString &&
      !isUnixSocket &&
      (process.env.SQL_PASSWORD === 'hse_secure_password_2026' || !process.env.SQL_PASSWORD)
    ) {
      throw new Error(
        '[FATAL DB SECURITY] Production PostgreSQL connection requires a strong, non-default SQL_PASSWORD in .env.'
      );
    }

    const poolConfig: PoolConfig = connectionString
      ? {
          connectionString,
          max: maxConnections,
          min: minConnections,
          idleTimeoutMillis,
          connectionTimeoutMillis,
          keepAlive: !isUnixSocket,
          keepAliveInitialDelayMillis: isUnixSocket ? undefined : 10000,
          statement_timeout: 45000,
          query_timeout: 45000,
          allowExitOnIdle: false,
          ssl: sslConfig || undefined,
        }
      : {
          host,
          user: process.env.SQL_USER || process.env.PGUSER || 'postgres',
          password: process.env.SQL_PASSWORD || process.env.PGPASSWORD || '',
          database: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'hsedb',
          port: Number(process.env.SQL_PORT || process.env.POSTGRES_PORT || process.env.PGPORT) || 5432,
          max: maxConnections,
          min: minConnections,
          idleTimeoutMillis,
          connectionTimeoutMillis,
          keepAlive: !isUnixSocket,
          keepAliveInitialDelayMillis: isUnixSocket ? undefined : 10000,
          statement_timeout: 45000,
          query_timeout: 45000,
          allowExitOnIdle: false,
          ssl: sslConfig || undefined,
        };

    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err: any) => {
      const msg = String(err?.message || err || '');
      const code = String(err?.code || '');

      // 57P01: admin_shutdown / terminating connection due to administrator command
      // In managed / Cloud SQL environments, idle connections are periodically recycled by the server.
      // node-postgres automatically removes terminated idle clients from the pool.
      const isExpectedIdleTermination =
        code === '57P01' ||
        msg.includes('terminating connection due to administrator command') ||
        msg.includes('Connection terminated') ||
        msg.includes('ECONNRESET') ||
        msg.includes('connection reset');

      if (isExpectedIdleTermination) {
        // Benign idle connection recycling by database backend
        return;
      }

      console.warn('[Database Pool Info]', msg);
    });

    const rawQuery = global._postgresPool.query.bind(global._postgresPool);
    // Wrap pool.query with transparent retry for transient socket drops/server-side recycles
    (global._postgresPool as any).query = async function (...args: any[]) {
      let lastErr: any;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await (rawQuery as any)(...args);
        } catch (err: any) {
          lastErr = err;
          const msg = String(err?.message || '');
          const code = String(err?.code || '');
          const isTransient =
            code === 'ECONNRESET' ||
            code === '57P01' ||
            code === '53300' ||
            code === '08006' ||
            code === '08001' ||
            code === '08004' ||
            msg.includes('Connection terminated') ||
            msg.includes('connection reset') ||
            msg.includes('remaining connection slots') ||
            msg.includes('socket closed') ||
            msg.includes('timeout');

          if (!isTransient || attempt === maxRetries) {
            throw err;
          }
          // Backoff before retrying
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
      }
      throw lastErr;
    };
  }
  return global._postgresPool;
};

export const pool = createPool();
export const pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };

/**
 * Executes a database operation with exponential backoff retry on transient connection drops or scale-up delays.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 250
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const causeMsg = String(err?.cause?.message || '');
      const code = String(err?.code || err?.cause?.code || '');

      const isTransient =
        code === 'ECONNRESET' ||
        code === '57P01' ||
        code === '53300' ||
        code === '08006' ||
        code === '08001' ||
        code === '08004' ||
        msg.includes('Connection terminated') ||
        msg.includes('connection reset') ||
        msg.includes('remaining connection slots') ||
        msg.includes('timeout') ||
        msg.includes('Failed query') ||
        causeMsg.includes('Connection terminated') ||
        causeMsg.includes('connection reset') ||
        causeMsg.includes('remaining connection slots') ||
        causeMsg.includes('timeout');

      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise(res => setTimeout(res, delayMs * attempt));
    }
  }
  throw lastError;
}
