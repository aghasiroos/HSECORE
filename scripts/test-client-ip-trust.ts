import assert from 'node:assert/strict';
import type { Request } from 'express';
import { getClientIp } from '../server/core/ip.ts';

const spoofedForwardingHeaders = {
  'x-forwarded-for': '203.0.113.250, 198.51.100.10',
  'x-real-ip': '203.0.113.250',
};

const trustedProxyRequest = {
  ip: '198.51.100.10',
  headers: spoofedForwardingHeaders,
  socket: { remoteAddress: '10.0.0.5' },
} as unknown as Request;

assert.equal(
  getClientIp(trustedProxyRequest),
  '198.51.100.10',
  'rate limiting must use the IP resolved by Express trust-proxy, not the first client-controlled X-Forwarded-For value',
);

const directRequestWithoutResolvedIp = {
  ip: '',
  headers: spoofedForwardingHeaders,
  socket: { remoteAddress: '192.0.2.20' },
} as unknown as Request;

assert.equal(
  getClientIp(directRequestWithoutResolvedIp),
  '192.0.2.20',
  'fallback must use the transport peer and ignore untrusted forwarding headers',
);

console.log('PASS: client IP resolution ignores spoofable forwarding headers.');
