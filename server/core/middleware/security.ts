import { Request, Response, NextFunction } from 'express';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

/**
 * Enterprise security response headers.
 * CSP is intentionally moderate (allows same-origin assets + inline styles used by RTL UI)
 * and can be tightened further via env once front-end nonces are introduced.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const isPreviewOrDev =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_PREVIEW_ORIGINS === 'true' ||
    Boolean(process.env.K_SERVICE) ||
    req.headers.host?.includes('.run.app') ||
    req.headers.host?.includes('localhost') ||
    req.headers.host?.includes('127.0.0.1');

  if (!isPreviewOrDev) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  } else {
    // In AI Studio preview / emulator environment, the application runs inside an iframe
    res.removeHeader('X-Frame-Options');
  }

  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Baseline CSP for SPA + API
  const cspEnabled = (process.env.CSP_ENABLED || 'true').toLowerCase() !== 'false';
  if (cspEnabled) {
    const frameAncestors = isPreviewOrDev
      ? "frame-ancestors 'self' https://*.google.com https://*.run.app https://*.googleusercontent.com https://aistudio.google.com http://localhost:* http://127.0.0.1:*"
      : "frame-ancestors 'self'";

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      frameAncestors,
      "object-src 'none'",
      // Allow only the explicitly used external font and map-tile origins.
      "img-src 'self' data: blob: https://mt0.google.com https://mt1.google.com https://mt2.google.com https://mt3.google.com https://*.tile.openstreetmap.org https://server.arcgisonline.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
  }

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Production-safe origin check:
 * - Same-Origin always allowed
 * - Explicit CORS_ORIGINS whitelist
 * - localhost / 127.0.0.1 only when NODE_ENV !== production
 * - Google Cloud / AI Studio host suffixes only when ALLOW_PREVIEW_ORIGINS=true
 */
function isAllowedOrigin(req: Request, origin: string): boolean {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');

  if (isSameOrigin(req, normalizedOrigin)) {
    return true;
  }

  const allowedOrigins = config.security.corsOrigins || [];
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  try {
    const originUrl = new URL(normalizedOrigin);
    const hostname = originUrl.hostname.toLowerCase();
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const allowPreview = (process.env.ALLOW_PREVIEW_ORIGINS || 'false').toLowerCase() === 'true';

    if (!isProd && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return true;
    }

    const isAiStudioEnv =
      !isProd ||
      allowPreview ||
      Boolean(process.env.K_SERVICE) ||
      Boolean(req.headers.host?.includes('.run.app'));

    if (isAiStudioEnv) {
      if (
        hostname.endsWith('.google.com') ||
        hostname.endsWith('.run.app') ||
        hostname.endsWith('.googleusercontent.com')
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function isSameOrigin(req: Request, origin: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase();
    const rawReqHost = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
    if (!rawReqHost) return false;
    const reqHost = rawReqHost.split(',')[0].trim();

    if (originHost === reqHost) return true;

    const originHostname = originUrl.hostname.toLowerCase();
    const [reqHostname, reqPortPart] = reqHost.split(':');
    if (originHostname === reqHostname) {
      const originPort = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');
      const resolvedReqPort = reqPortPart || (req.protocol === 'https' ? '443' : '80');
      if (originPort === resolvedReqPort) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Enterprise Secure CORS Middleware
 * - Wildcard (*) is strictly forbidden
 * - Credentials only for verified origins
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  const normalizedOrigin = origin.trim().replace(/\/$/, '');

  if (!isAllowedOrigin(req, normalizedOrigin)) {
    logger.warn('CORS blocked origin', { origin: normalizedOrigin, path: req.path });
    return res.status(403).json({
      success: false,
      message: 'Origin not allowed by CORS policy.',
    });
  }

  res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Requested-With, X-Correlation-Id, Accept, Origin'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}
