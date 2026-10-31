import { Router } from 'express';
import { aiController } from './ai.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

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

// Chat endpoint with orchestrator & domain tool execution
router.post('/chat', requireAuth, (req, res, next) => {
  aiController.chat(req, res).catch(next);
});

// AI Audit logs & telemetry (Admins and HSE Managers)
router.get('/audit', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  aiController.getAuditLogs(req, res).catch(next);
});

// Admin-only model management
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

router.post('/knowledge', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  aiController.createKnowledgeDoc(req, res).catch(next);
});

router.delete('/knowledge/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
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
