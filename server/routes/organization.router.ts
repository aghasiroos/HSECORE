import { Router } from 'express';
import { db } from '../../src/db/index.ts';
import { systemSettings } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { requireAuth, requireRole } from '../core/middleware/auth.ts';
import { broadcastDataMutation } from '../core/socket.ts';

export const organizationRouter = Router();

organizationRouter.get('/nodes', requireAuth, async (req, res) => {
  try {
    const records = await db.select().from(systemSettings).where(eq(systemSettings.key, 'org_nodes'));
    if (records.length > 0) {
      res.json({ success: true, data: records[0].value });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err) {
    logger.error('Failed to get org nodes', err);
    res.status(500).json({ success: false, message: 'Failed to fetch org nodes' });
  }
});

organizationRouter.post('/nodes', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req, res) => {
  try {
    const value = req.body; // Array of OrgNode
    await db.insert(systemSettings)
      .values({ key: 'org_nodes', value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() }
      });
    
    broadcastDataMutation('organization:nodes', 'update', value);
    broadcastDataMutation('departments', 'update', value);
    res.json({ success: true, message: 'Saved successfully' });
  } catch (err) {
    logger.error('Failed to save org nodes', err);
    res.status(500).json({ success: false, message: 'Failed to save org nodes' });
  }
});
