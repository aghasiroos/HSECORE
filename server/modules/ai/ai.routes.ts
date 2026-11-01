import { Router } from 'express';
import { aiController } from './ai.controller.ts';
import { requireAuth, requirePermission, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

// Engine & Queue health/status (accessible internally & by UI)
router.get('/status', requireAuth, (req, res, next) => {
  aiController.getStatus(req, res).catch(next);
});

// List 10 specialized assistants metadata
router.get('/assistants', requireAuth, (req, res, next) => {
  aiController.listAssistants(req, res).catch(next);
});

// List installed models
router.get('/models', requireAuth, (req, res, next) => {
  aiController.listModels(req, res).catch(next);
});


// Provider registry (Phase 3a — currently Ollama only)
router.get('/providers', requireAuth, (req, res, next) => {
  aiController.listProviders(req, res).catch(next);
});

// Model assignments & resource settings (Phase 3b)
router.get('/assignments', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  aiController.listAssignments(req, res).catch(next);
});

router.put('/assignments/:serviceKey', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.upsertAssignment(req, res).catch(next);
});

router.get('/settings/resources', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  aiController.getResourceSettings(req, res).catch(next);
});

router.put('/settings/resources', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.putResourceSettings(req, res).catch(next);
});

router.post('/models/sync', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.syncInstalledModels(req, res).catch(next);
});

// Chat endpoint with orchestrator & domain tool execution
router.post('/chat', requireAuth, (req, res, next) => {
  aiController.chat(req, res).catch(next);
});

// ---------- Persistent Chat Sessions (user-isolated, replaces localStorage) ----------
router.get('/sessions', requireAuth, (req, res, next) => {
  aiController.listSessions(req, res).catch(next);
});

router.post('/sessions', requireAuth, (req, res, next) => {
  aiController.createSession(req, res).catch(next);
});

router.get('/sessions/:id/messages', requireAuth, (req, res, next) => {
  aiController.getSessionMessages(req, res).catch(next);
});

router.post('/sessions/:id/messages', requireAuth, (req, res, next) => {
  aiController.appendSessionMessage(req, res).catch(next);
});

router.delete('/sessions/:id', requireAuth, (req, res, next) => {
  aiController.deleteSession(req, res).catch(next);
});

router.post('/sessions/import-local', requireAuth, (req, res, next) => {
  aiController.importLocalSessions(req, res).catch(next);
});

// AI Module Registry / coverage report
router.get('/coverage', requireAuth, (req, res, next) => {
  aiController.getModuleCoverage(req, res).catch(next);
});

// AI Audit logs & telemetry (Admins and HSE Managers)
router.get('/audit', requireAuth, requirePermission('audit:read'), (req, res, next) => {
  aiController.getAuditLogs(req, res).catch(next);
});

// Admin-only model management

// Deployment jobs — async pull/delete with progress (Phase 3c)
router.get('/jobs', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  aiController.listJobs(req, res).catch(next);
});

router.get('/jobs/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  aiController.getJob(req, res).catch(next);
});

router.post('/jobs/pull', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.enqueuePullJob(req, res).catch(next);
});

router.post('/jobs/delete', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.enqueueDeleteJob(req, res).catch(next);
});

router.post('/models/pull', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.pullModel(req, res).catch(next);
});

router.delete('/models/:name', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  aiController.deleteModel(req, res).catch(next);
});

// Knowledge Base & RAG management
router.get('/knowledge', requireAuth, (req, res, next) => {
  aiController.listKnowledgeDocs(req, res).catch(next);
});

router.post('/knowledge', requireAuth, requirePermission('documents:create'), (req, res, next) => {
  aiController.createKnowledgeDoc(req, res).catch(next);
});

router.delete('/knowledge/:id', requireAuth, requirePermission('documents:delete'), (req, res, next) => {
  aiController.deleteKnowledgeDoc(req, res).catch(next);
});

router.post('/knowledge/query', requireAuth, (req, res, next) => {
  aiController.queryKnowledge(req, res).catch(next);
});

// Legacy/BPMN process generator backward-compatibility
router.post('/process/generate-ai', requireAuth, (req, res, next) => {
  aiController.generateBPMN(req, res).catch(next);
});

export default router;
