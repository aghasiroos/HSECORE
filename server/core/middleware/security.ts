import { Request, Response, NextFunction } from 'express';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Remove Express signature
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Check if the origin is permitted, including Same-Origin, explicitly whitelisted domains,
 * and AI Studio / Google Cloud preview environments.
 */
function isAllowedOrigin(req: Request, origin: string): boolean {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');

  // 1. Same-Origin verification
  if (isSameOrigin(req, normalizedOrigin)) {
    return true;
  }

  // 2. Configured origins from environment / config
  const allowedOrigins = config.security.corsOrigins || [];
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // 3. AI Studio preview, Google Cloud Run, and localhost environments
  try {
    const originUrl = new URL(normalizedOrigin);
    const hostname = originUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.google.com') ||
      hostname.endsWith('.run.app') ||
      hostname.endsWith('.googleusercontent.com')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Helper to dynamically detect if an incoming request Origin is Same-Origin
 * relative to the server's host as resolved by Express and Reverse Proxy (Nginx).
 */
function isSameOrigin(req: Request, origin: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase(); // includes hostname:port if non-standard

    // Get the request host (Express resolves this via X-Forwarded-Host if proxy is trusted, or Host header)
    const rawReqHost = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
    if (!rawReqHost) {
      return false;
    }

    // Split multiple comma-separated proxy hosts if present
    const reqHost = rawReqHost.split(',')[0].trim();

    // 1. Direct match on host (hostname:port)
    if (originHost === reqHost) {
      return true;
    }

    // 2. Normalized hostname and port comparison
    const originHostname = originUrl.hostname.toLowerCase();
    const [reqHostname, reqPortPart] = reqHost.split(':');
    if (originHostname === reqHostname) {
      const originPort = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');
      const resolvedReqPort = reqPortPart || (req.protocol === 'https' ? '443' : '80');
      if (originPort === resolvedReqPort) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Enterprise Secure CORS Middleware (Deployment-Agnostic)
 * - Dynamically verifies Same-Origin requests without hardcoded IP or domain.
 * - Supports explicit Cross-Origin whitelist from CORS_ORIGINS environment variable.
 * - Wildcard (*) is strictly forbidden.
 * - Credentials and JWT headers are securely permitted only for verified origins.
 * - Unauthorized external origins are rejected with HTTP 403 Forbidden.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // Requests without an Origin header (e.g. server-to-server, direct cURL, standard GET navigation)
  if (!origin) {
    return next();
  }

  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  // Dynamic verification: either Same-Origin, whitelisted domain, or AI Studio environment
  const isAllowed = isAllowedOrigin(req, normalizedOrigin);

  if (!isAllowed) {
    logger.warn('CORS request rejected from unauthorized origin', {
      origin: normalizedOrigin,
      host: req.get('host'),
      xForwardedHost: req.get('x-forwarded-host'),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ORIGIN_DENIED',
        message: 'دسترسی از این مبدأ (Origin) توسط سیاست امنیتی سامانه مسدود شده است.',
      },
    });
  }

  // Origin is authorized: set explicit CORS response headers (Never use wildcard '*')
  res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-correlation-id, x-user-id, x-user-role, x-user-name'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  // Preflight OPTIONS requests for authorized origin
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}
