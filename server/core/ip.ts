import { Request } from 'express';

/**
 * Accurately extracts the real client IP address behind reverse proxies (Nginx, Cloud Run)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const parts = forwarded.split(',').map(s => s.trim());
    if (parts[0] && parts[0] !== '::1' && parts[0] !== '127.0.0.1') {
      return parts[0];
    }
    if (parts[0]) return parts[0];
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0].trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}
