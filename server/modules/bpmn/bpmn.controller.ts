import { Request, Response } from 'express';
import { bpmnService } from './bpmn.service.ts';
import { ApiResponse } from '../../core/response.ts';

export class BPMNController {
  async getAllProcesses(req: Request, res: Response) {
    const list = await bpmnService.getAllProcesses();
    return res.json({ success: true, data: list });
  }

  async getVersions(req: Request, res: Response) {
    const processId = parseInt(req.params.id, 10);
    const versions = await bpmnService.getProcessVersions(processId);
    return res.json({ success: true, data: versions });
  }

  async deployProcess(req: Request, res: Response) {
    const result = await bpmnService.deployProcess(req.body, req.user);
    return res.json(result);
  }

  async simulateProcess(req: Request, res: Response) {
    const result = await bpmnService.simulateProcess(req.body);
    return res.json({ success: true, data: result });
  }

  async getActiveInstances(req: Request, res: Response) {
    const instances = await bpmnService.getActiveInstances();
    return res.json({ success: true, data: instances });
  }

  async intervene(req: Request, res: Response) {
    const { instanceId, action, ...params } = req.body;
    const result = await bpmnService.interveneInstance(instanceId, action, params);
    return res.json(result);
  }

  async getStatistics(req: Request, res: Response) {
    const stats = await bpmnService.getStatistics();
    return res.json({ success: true, data: stats });
  }

  async uploadBpmn(req: Request, res: Response) {
    const { name, bpmnXml, status } = req.body;
    const process = await bpmnService.uploadBpmn({
      name,
      bpmnXml,
      status,
      owner: (req.headers['x-user-name'] as string) || req.user?.name || 'admin',
    });
    return res.json({ success: true, data: process });
  }

  async getBpmnList(req: Request, res: Response) {
    const list = await bpmnService.getBpmnList();
    return res.json({ success: true, data: list });
  }

  async getBpmnById(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const process = await bpmnService.getBpmnById(id);
    return res.json({ success: true, data: process });
  }

  async getBpmnXml(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const xml = await bpmnService.getBpmnXml(id);
    res.setHeader('Content-Type', 'application/xml');
    return res.send(xml);
  }

  async deleteBpmn(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const result = await bpmnService.deleteBpmn(id);
    return res.json(result);
  }
}

export const bpmnController = new BPMNController();
