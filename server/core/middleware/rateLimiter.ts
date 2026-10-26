import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.ts';
import { getClientIp } from '../ip.ts';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, Math.min(options.windowMs, 60000));

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (
      options.keyPrefix === 'std' &&
      (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') &&
      (req.path.startsWith('/v1/settings') || req.path.startsWith('/system/version') || req.path.startsWith('/health'))
    ) {
      return next();
    }

    // Strictly use centralized and trusted IP detection with optional auth token differentiator
    const clientIp = getClientIp(req);
    let identifier = clientIp;
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ') && authHeader.length > 20) {
      identifier = `${clientIp}:${authHeader.slice(-16)}`;
    }
    const key = `${options.keyPrefix || 'rl'}:${identifier}`;
    const now = Date.now();

    const record = store.get(key);
    if (!record || now > record.resetTime) {
      store.set(key, { count: 1, resetTime: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      logger.warn('Rate limit exceeded', { ip: clientIp, key, maxRequests: options.maxRequests });
      return next(
        new AppError(
          options.message || 'تعداد درخواست‌های شما از حد مجاز فراتر رفته است. لطفاً کمی بعد دوباره تلاش کنید.',
          429,
          'RATE_LIMIT_EXCEEDED'
        )
      );
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    next();
  };
}

export const standardRateLimiter = createRateLimiter({
  keyPrefix: 'std',
  windowMs: 60 * 1000,
  maxRequests: config.security.rateLimitMax || 50000,
});

/**
 * Dedicated Rate Limiter for Authentication / Login endpoints
 */
export const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth_login',
  windowMs: config.security.authRateLimitWindowMs || 15 * 60 * 1000,
  maxRequests: config.security.authRateLimitMax || 10,
  message: 'تعداد تلاش‌های ناموفق یا درخواست‌های احراز هویت بیش از حد مجاز است. لطفاً پس از ۱۵ دقیقه مجدداً تلاش فرمایید.',
});

/**
 * Dedicated Rate Limiter for Password Change / Reset endpoints
 */
export const passwordChangeRateLimiter = createRateLimiter({
  keyPrefix: 'auth_pwd',
  windowMs: 60 * 60 * 1000, // 1 hour window
  maxRequests: 5, // 5 requests per hour
  message: 'تعداد دفعات تلاش برای تغییر یا بازنشانی کلمه عبور بیش از حد مجاز است. لطفاً یک ساعت بعد دوباره تلاش فرمایید.',
});

export const sensitiveActionRateLimiter = createRateLimiter({
  keyPrefix: 'sensitive',
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'نرخ انجام عملیات حساس بیش از حد مجاز است. لطفاً یک دقیقه صبر کنید.',
});

export const apiRateLimiter = standardRateLimiter;
