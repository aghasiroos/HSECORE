import { Request } from 'express';

/**
 * Returns the client address resolved by Express using the application's
 * configured trust-proxy policy. Never trust raw forwarding headers here:
 * clients can supply X-Forwarded-For themselves unless a trusted proxy
 * sanitizes and appends the chain correctly.
 */
export function getClientIp(req: Request): string {
  const trustedIp = req.ip?.trim();
  if (trustedIp) return trustedIp;

  const socketIp = req.socket?.remoteAddress?.trim();
  if (socketIp) return socketIp;

  return '127.0.0.1';
}
