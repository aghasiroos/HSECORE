/**
 * HTTP-level authorization regression tests for AI knowledge management routes.
 */
import assert from 'node:assert/strict';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { config } from '../server/core/config.ts';
import { aiRagService } from '../server/modules/ai/ai.rag.service.ts';
import aiRoutes from '../server/modules/ai/ai.routes.ts';

function tokenFor(uid: string, role: string): string {
  return jwt.sign({ uid, role }, config.security.jwtSecret, { expiresIn: '5m' });
}

async function run() {
  const originalIndex = aiRagService.indexDocument;
  const originalCanAccess = aiRagService.canAccessDocument;
  const originalDelete = aiRagService.deleteDocument;

  let indexCalls = 0;
  let deleteCalls = 0;
  let canAccessResult = false;

  aiRagService.indexDocument = (async () => {
    indexCalls++;
    return { docId: 7001, id: 7001, chunkCount: 1 };
  }) as typeof aiRagService.indexDocument;

  aiRagService.canAccessDocument = (async () => canAccessResult) as typeof aiRagService.canAccessDocument;

  aiRagService.deleteDocument = (async () => {
    deleteCalls++;
    return true;
  }) as typeof aiRagService.deleteDocument;

  const app = express();
  app.use(express.json());
  app.use('/ai', aiRoutes);
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(Number(error?.statusCode) || 500).json({
      success: false,
      message: error?.message || 'Internal error',
    });
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/ai`;

  async function request(pathname: string, options: {
    method?: string;
    role?: string;
    uid?: string;
    body?: unknown;
    spoofedHeaders?: boolean;
  } = {}) {
    const headers: Record<string, string> = {};
    if (options.role) {
      headers.authorization = `Bearer ${tokenFor(options.uid || 'route-test-user', options.role)}`;
    }
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.spoofedHeaders) {
      headers['x-hse-user-id'] = 'attacker-admin';
      headers['x-hse-user-role'] = 'ADMIN';
    }
    return fetch(`${baseUrl}${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  try {
    const unauthenticated = await request('/knowledge');
    assert.equal(unauthenticated.status, 401);
    const spoofed = await request('/knowledge', { spoofedHeaders: true });
    assert.equal(spoofed.status, 401);
    console.log('PASS AI knowledge routes require a signed-in JWT; spoofed headers are rejected');

    const workerCreate = await request('/knowledge', {
      method: 'POST',
      role: 'WORKER',
      body: { title: 'Denied', content: 'Not allowed' },
    });
    assert.equal(workerCreate.status, 403);
    assert.equal(indexCalls, 0);
    console.log('PASS users without documents:create cannot create knowledge documents');

    const malformedAcl = await request('/knowledge', {
      method: 'POST',
      role: 'SAFETY_OFFICER',
      body: { title: 'Invalid ACL', content: 'Example', accessControl: null },
    });
    assert.equal(malformedAcl.status, 400);
    assert.equal(indexCalls, 0);
    console.log('PASS malformed accessControl input is rejected before indexing');

    const inaccessibleCategoryCreate = await request('/knowledge', {
      method: 'POST',
      role: 'SAFETY_OFFICER',
      body: { title: 'Inaccessible category', content: 'Health document', category: 'HEALTH' },
    });
    assert.equal(inaccessibleCategoryCreate.status, 403);
    assert.equal(indexCalls, 0);
    console.log('PASS users cannot create documents in categories they cannot access');

    const safetyCreate = await request('/knowledge', {
      method: 'POST',
      role: 'SAFETY_OFFICER',
      body: { title: 'Authorized create', content: 'Safety document', category: 'GENERAL' },
    });
    assert.equal(safetyCreate.status, 200);
    assert.equal(indexCalls, 1);
    console.log('PASS documents:create permission authorizes knowledge document creation');

    const safetyDelete = await request('/knowledge/7001', {
      method: 'DELETE',
      role: 'SAFETY_OFFICER',
    });
    assert.equal(safetyDelete.status, 403);
    assert.equal(deleteCalls, 0);
    console.log('PASS user without documents:delete cannot invoke knowledge deletion');

    canAccessResult = false;
    const hseAclDenied = await request('/knowledge/7001', {
      method: 'DELETE',
      role: 'HSE_MANAGER',
    });
    assert.equal(hseAclDenied.status, 404);
    assert.equal(deleteCalls, 0);
    console.log('PASS delete is denied when the document ACL does not grant access');

    canAccessResult = true;
    const hseAclAllowed = await request('/knowledge/7001', {
      method: 'DELETE',
      role: 'HSE_MANAGER',
    });
    assert.equal(hseAclAllowed.status, 200);
    assert.equal(deleteCalls, 1);
    console.log('PASS authorized HSE manager can delete an ACL-accessible document');

    console.log('AI HTTP route authorization tests: 8/8 passed');
  } finally {
    aiRagService.indexDocument = originalIndex;
    aiRagService.canAccessDocument = originalCanAccess;
    aiRagService.deleteDocument = originalDelete;
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

run().catch(error => {
  console.error('AI HTTP route authorization tests failed:', error);
  process.exitCode = 1;
});
