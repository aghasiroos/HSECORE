/**
 * JWT authentication regression tests for the AI security path.
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { authenticateToken } from '../server/core/middleware/auth.ts';
import { config } from '../server/core/config.ts';

function requestWith(options: {
  authorization?: string;
  cookieToken?: string;
  queryToken?: string;
  spoofedHeaders?: boolean;
} = {}): Request {
  const headers: Record<string, string> = {};
  if (options.authorization) headers.authorization = options.authorization;
  if (options.spoofedHeaders) {
    headers['x-hse-user-id'] = 'attacker-admin';
    headers['x-hse-username'] = 'admin';
    headers['x-hse-user-role'] = 'ADMIN';
  }

  return {
    headers,
    query: options.queryToken ? { token: options.queryToken } : {},
    cookies: options.cookieToken ? { hse_auth_token: options.cookieToken } : {},
  } as unknown as Request;
}

async function run() {
  assert.ok(config.security.jwtSecret.length >= 32, 'Test JWT secret must be at least 32 characters');

  const validToken = jwt.sign({
    uid: 'jwt-test-user',
    username: 'jwt-worker',
    role: 'WORKER',
    permissions: ['ptw:read'],
  }, config.security.jwtSecret, { expiresIn: '5m' });

  const validUser = await authenticateToken(requestWith({ authorization: `Bearer ${validToken}` }));
  assert.equal(validUser?.uid, 'jwt-test-user');
  assert.equal(validUser?.role, 'WORKER');
  assert.deepEqual(validUser?.permissions, ['ptw:read']);
  console.log('PASS valid server-signed JWT is accepted');

  const forgedToken = jwt.sign({
    uid: 'attacker-admin',
    username: 'admin',
    role: 'ADMIN',
  }, 'attacker-controlled-signing-key-that-is-long-enough');
  assert.equal(await authenticateToken(requestWith({ authorization: `Bearer ${forgedToken}` })), null);
  console.log('PASS JWT signed with an attacker-controlled secret is rejected');

  const expiredToken = jwt.sign({
    uid: 'expired-user',
    role: 'WORKER',
  }, config.security.jwtSecret, { expiresIn: -1 });
  assert.equal(await authenticateToken(requestWith({ authorization: `Bearer ${expiredToken}` })), null);
  console.log('PASS expired JWT is rejected');

  assert.equal(await authenticateToken(requestWith({ spoofedHeaders: true })), null);
  console.log('PASS spoofed identity and role headers cannot authenticate a request');

  const cookieUser = await authenticateToken(requestWith({ cookieToken: validToken }));
  assert.equal(cookieUser?.uid, 'jwt-test-user');
  console.log('PASS HttpOnly cookie token is accepted');

  console.log('AI JWT authentication tests: 5/5 passed');
}

run().catch(error => {
  console.error('AI JWT authentication tests failed:', error);
  process.exitCode = 1;
});
