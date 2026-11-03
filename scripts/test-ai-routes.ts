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
import { aiOrchestrator, canUserAccessAITool, isExplicitAllModulesCommand } from '../server/modules/ai/ai.orchestrator.ts';

function tokenFor(uid: string, role: string): string {
  return jwt.sign({ uid, role }, config.security.jwtSecret, { expiresIn: '5m' });
}

async function run() {
  assert.equal(isExplicitAllModulesCommand('/ALL'), true);
  assert.equal(isExplicitAllModulesCommand('/all گزارش جامع'), true);
  assert.equal(isExplicitAllModulesCommand('  / ALL  '), true);
  assert.equal(isExplicitAllModulesCommand('/ptw'), false);
  assert.equal(isExplicitAllModulesCommand('گزارش کلی سامانه'), false);
  console.log('PASS typed /ALL command parser accepts case/spacing variants without matching other slash commands');
  assert.equal(canUserAccessAITool('ptw_summary', { uid: 'worker-1', role: 'WORKER' }), true);
  assert.equal(canUserAccessAITool('health_medical_summary', { uid: 'worker-1', role: 'WORKER' }), false);
  assert.equal(canUserAccessAITool('users_roles_summary', { uid: 'worker-1', role: 'WORKER' }), false);
  assert.equal(canUserAccessAITool('fire_safety_summary', { uid: 'safety-1', role: 'SAFETY_OFFICER' }), true);
  assert.equal(canUserAccessAITool('health_medical_summary', { uid: 'safety-1', role: 'SAFETY_OFFICER' }), false);
  assert.equal(canUserAccessAITool('workflow_referrals_summary', { uid: 'safety-1', role: 'SAFETY_OFFICER' }), true);
  assert.equal(canUserAccessAITool('users_roles_summary', { uid: 'admin-1', role: 'ADMIN' }), true);
  assert.equal(canUserAccessAITool('settings_backup_summary', { uid: 'admin-1', role: 'ADMIN' }), true);
  assert.equal(canUserAccessAITool('ptw_summary', undefined), false);
  assert.equal(canUserAccessAITool('unregistered_tool', { uid: 'admin-1', role: 'ADMIN' }), false);
  console.log('PASS AI tool ACL: worker, safety officer, admin, and unauthenticated contexts');
  const originalIndex = aiRagService.indexDocument;
  const originalCanAccess = aiRagService.canAccessDocument;
  const originalDelete = aiRagService.deleteDocument;
  const originalProcessChat = aiOrchestrator.processChat;
  const originalGetModuleCoverage = aiOrchestrator.getModuleCoverage;

  let indexCalls = 0;
  let deleteCalls = 0;
  let canAccessResult = false;
  let chatCalls = 0;
  let capturedChatRequest: any = null;

  aiRagService.indexDocument = (async () => {
    indexCalls++;
    return { docId: 7001, id: 7001, chunkCount: 1 };
  }) as typeof aiRagService.indexDocument;

  aiRagService.canAccessDocument = (async () => canAccessResult) as typeof aiRagService.canAccessDocument;

  aiOrchestrator.getModuleCoverage = (async () => [
    { moduleId: 'ptw', moduleNameFa: 'پروانه کار', connected: true, tools: ['ptw_summary'], assistantIds: ['GENERAL_HSE'] },
    { moduleId: 'ptw-test-tab', moduleNameFa: 'تب آزمون پروانه کار', connected: true, tools: ['ptw_summary'], assistantIds: ['GENERAL_HSE'], parentModuleId: 'ptw', level: 1 },
  ]) as typeof aiOrchestrator.getModuleCoverage;

  aiOrchestrator.processChat = (async (request: any) => {
    chatCalls++;
    capturedChatRequest = request;
    return {
      success: true, reply: 'گزارش آزمایشی بر پایه داده‌های مجاز', assistantId: 'GENERAL_HSE',
      toolsUsed: ['ماژول پروانه کار'], citations: ['ماژول پروانه کار'], durationMs: 12,
      model: 'test-model', queueWaitMs: 0,
    };
  }) as typeof aiOrchestrator.processChat;

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

    const unauthenticatedChat = await request('/chat', { method: 'POST', body: { message: 'تحلیل سامانه' } });
    assert.equal(unauthenticatedChat.status, 401);
    assert.equal(chatCalls, 0);
    console.log('PASS AI analytics chat requires authentication');

    const moduleCoverage = await request('/coverage', { method: 'GET', role: 'ADMIN' });
    const coveragePayload = await moduleCoverage.json() as any;
    assert.equal(moduleCoverage.status, 200);
    assert.equal(coveragePayload.data.some((item: any) => item.moduleId === 'ptw-test-tab' && item.parentModuleId === 'ptw'), true);
    console.log('PASS slash picker coverage exposes hierarchical module and tab metadata');

    const selectedModuleChat = await request('/chat', {
      method: 'POST',
      role: 'ADMIN',
      body: { message: 'گزارش مدیریتی', selectedModules: ['ptw', 'incidents'], model: 'test-model', contextTokens: 4096, stream: false },
    });
    const selectedModulePayload = await selectedModuleChat.json() as any;
    assert.equal(selectedModuleChat.status, 200);
    assert.equal(selectedModulePayload.success, true);
    assert.equal(chatCalls, 1);
    assert.deepEqual(capturedChatRequest.selectedModules, ['ptw', 'incidents']);
    assert.equal(capturedChatRequest.model, 'test-model');
    assert.equal(capturedChatRequest.contextTokens, 4096);
    assert.deepEqual(selectedModulePayload.toolsUsed, ['ماژول پروانه کار']);
    console.log('PASS selected modules are forwarded to the secure orchestrator and source metadata is returned');

    const allModulesChat = await request('/chat', {
      method: 'POST',
      role: 'ADMIN',
      body: { message: 'گزارش کلی سامانه', selectedModules: ['all'], stream: true },
    });
    const streamPayload = await allModulesChat.text();
    assert.equal(allModulesChat.status, 200);
    assert.match(streamPayload, /"token":"گزارش آزمایشی بر پایه داده‌های مجاز"/);
    assert.match(streamPayload, /"toolsUsed":\["ماژول پروانه کار"\]/);
    assert.equal(chatCalls, 2);
    assert.deepEqual(capturedChatRequest.selectedModules, ['all']);
    console.log('PASS /ALL streaming response includes the orchestrator source metadata');


    console.log('AI HTTP route authorization and analytics tests: 12/12 passed');
  } finally {
    aiRagService.indexDocument = originalIndex;
    aiRagService.canAccessDocument = originalCanAccess;
    aiRagService.deleteDocument = originalDelete;
    aiOrchestrator.processChat = originalProcessChat;
    aiOrchestrator.getModuleCoverage = originalGetModuleCoverage;
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

run().catch(error => {
  console.error('AI HTTP route authorization tests failed:', error);
  process.exitCode = 1;
});
