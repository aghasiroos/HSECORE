import { Request, Response } from 'express';
import { monitoringService } from './monitoring.service.ts';
import { openApiSpec } from './openapi.doc.ts';
import { ApiResponse } from '../../core/response.ts';

export class MonitoringController {
  async getHealth(req: Request, res: Response) {
    const health = await monitoringService.getOverallHealth();
    return res.status(health.status === 'healthy' ? 200 : 503).json(health);
  }

  async getDbHealth(req: Request, res: Response) {
    const dbHealth = await monitoringService.getDbHealth();
    return res.status(dbHealth.status === 'healthy' ? 200 : 503).json(dbHealth);
  }

  async getServicesHealth(req: Request, res: Response) {
    const services = await monitoringService.getServicesHealth();
    return ApiResponse.success(res, services);
  }

  getOpenApiSpec(req: Request, res: Response) {
    return res.json(openApiSpec);
  }

  getArchitectureStatus(req: Request, res: Response) {
    return ApiResponse.success(res, {
      architecture: 'Modular Monolith',
      framework: 'Express + TypeScript Strict',
      database: 'Enterprise Central Database',
      workflowEngine: 'Universal Enterprise Workflow & Electronic Signature Engine',
      auditLogging: 'Non-tamperable Central Audit Trail',
      notifications: 'Central Multi-channel + SSE Realtime Stream',
      fileManagement: 'Central Secure Storage with Path Traversal Protection',
      modules: [
        'Auth & RBAC',
        'Personnel & Org Hierarchy',
        'Universal Workflow & Approval',
        'Work Permits (PTW) & Clash Detection',
        'Incidents & CAPA & RCA',
        'Occupational Health & Medical Exams',
        '5S Audits & Inspections',
        'Fire Equipment & Station Management',
        'Safety Warnings & Notice Deduplication',
        'Statistical Analytics (TRIR, LTIFR, SR, FSI)',
        'BPMN 2.0 Process Lifecycle & Simulation',
        'Gemini AI Assistant',
        'Monitoring, Health & Observability',
      ],
      compliance: {
        nodeVersion: process.version,
        dockerOptimized: true,
        zeroFrontendBreakage: true,
      },
    });
  }
}

export const monitoringController = new MonitoringController();
