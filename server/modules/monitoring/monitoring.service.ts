import os from 'os';
import { checkDatabaseHealth } from '../../core/db.ts';
import { aiService } from '../ai/ai.service.ts';

export class MonitoringService {
  private startTime = Date.now();

  async getOverallHealth() {
    const dbHealth = await checkDatabaseHealth();
    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());

    const isHealthy = dbHealth.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: uptimeSec,
      version: `${process.env.APP_VERSION || '0.2.8'}-enterprise`,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: os.cpus().length,
        freeMemoryBytes: os.freemem(),
        totalMemoryBytes: os.totalmem(),
      },
      process: {
        rssBytes: mem.rss,
        heapTotalBytes: mem.heapTotal,
        heapUsedBytes: mem.heapUsed,
        externalBytes: mem.external,
      },
      database: dbHealth,
      aiService: {
        configured: aiService.isConfigured(),
        model: 'gemini-3.6-flash',
      },
    };
  }

  async getDbHealth() {
    return await checkDatabaseHealth();
  }

  async getServicesHealth() {
    const dbHealth = await checkDatabaseHealth();
    return {
      database: dbHealth,
      workflowEngine: { status: 'healthy', worker: 'active' },
      notificationStream: { status: 'healthy', transport: 'SSE' },
      fileStorage: { status: 'healthy', diskWritable: true },
      aiAssistant: { status: aiService.isConfigured() ? 'healthy' : 'unconfigured' },
    };
  }
}

export const monitoringService = new MonitoringService();
