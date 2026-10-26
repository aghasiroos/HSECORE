import { Request, Response } from 'express';
import { workflowService } from './workflow.service.ts';
import { ApiResponse } from '../../core/response.ts';

export class WorkflowController {
  async createInstance(req: Request, res: Response) {
    const instance = await workflowService.createInstance(req.body, req.user);
    return ApiResponse.success(res, instance, undefined, 201);
  }

  async getAllInstances(req: Request, res: Response) {
    const instances = await workflowService.getAllInstances();
    return ApiResponse.success(res, instances, { total: instances.length });
  }

  async getInstanceById(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const instance = await workflowService.getInstanceDetails(id);
    return ApiResponse.success(res, instance);
  }

  async getByEntity(req: Request, res: Response) {
    const { entityType, entityId } = req.params;
    const instance = await workflowService.getInstanceByEntity(entityType, entityId);
    if (!instance) {
      return ApiResponse.success(res, null);
    }
    return ApiResponse.success(res, instance);
  }

  async executeAction(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const updated = await workflowService.executeAction(id, req.body, req.user, ip);
    return ApiResponse.success(res, updated);
  }

  async getSignatures(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const instance = await workflowService.getInstanceDetails(id);
    return ApiResponse.success(res, instance.signatures || []);
  }

  async getHistory(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const instance = await workflowService.getInstanceDetails(id);
    return ApiResponse.success(res, instance.history || []);
  }

  async getA4Verification(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const verification = await workflowService.getA4PrintableVerification(id);
    return ApiResponse.success(res, verification);
  }
}

export const workflowController = new WorkflowController();
