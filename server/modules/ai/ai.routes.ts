import { Router } from 'express';
import { aiController } from './ai.controller.ts';
import { requireAuth } from '../../core/middleware/auth.ts';

const router = Router();

router.post('/chat', requireAuth, (req, res, next) => {
  aiController.chat(req, res).catch(next);
});

router.post('/process/generate-ai', requireAuth, (req, res, next) => {
  aiController.generateBPMN(req, res).catch(next);
});

export default router;
