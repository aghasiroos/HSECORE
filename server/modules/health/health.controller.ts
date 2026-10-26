import { Request, Response } from 'express';
import { healthService } from './health.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';

export class HealthController {
  async getExamDetails(req: Request, res: Response) {
    const examId = parseInt(req.params.id, 10);
    const details = await healthService.getExamDetails(examId, req.user);
    return ApiResponse.success(res, details);
  }

  async getPersonnelHistory(req: Request, res: Response) {
    const history = await healthService.getPersonnelHistory(req.params.identifier, req.user);
    return ApiResponse.success(res, history);
  }

  async saveExam(req: Request, res: Response) {
    const result = await healthService.saveExam(req.body, req.user);
    broadcastDataMutation('medicalExams', 'upsert', result);
    return ApiResponse.success(res, result, undefined, 201);
  }

  async getA4FitnessCard(req: Request, res: Response) {
    const examId = parseInt(req.params.id, 10);
    const card = await healthService.getA4MedicalFitnessCard(examId);
    return ApiResponse.success(res, card);
  }

  // Clinic & Dispensary Handlers
  async getClinicVisits(req: Request, res: Response) {
    const visits = await healthService.getClinicVisits(req.user);
    return ApiResponse.success(res, visits);
  }

  async getPersonnelClinicHistory(req: Request, res: Response) {
    const identifier = req.params.identifier;
    const history = await healthService.getPersonnelClinicHistory(identifier, req.user);
    return ApiResponse.success(res, history);
  }

  async saveClinicVisit(req: Request, res: Response) {
    const result = await healthService.saveClinicVisit(req.body, req.user);
    broadcastDataMutation('clinicVisits', 'upsert', result);
    return ApiResponse.success(res, result, { message: 'اطلاعات مراجعه بهداری با موفقیت ثبت شد.' }, 201);
  }

  async deleteClinicVisit(req: Request, res: Response) {
    const result = await healthService.deleteClinicVisit(req.params.id, req.user);
    broadcastDataMutation('clinicVisits', 'delete', { id: req.params.id });
    return ApiResponse.success(res, result, { message: 'پرونده مراجعه بهداری حذف گردید.' });
  }

  // Nutrition Specialist Handlers
  async getNutritionRecords(req: Request, res: Response) {
    const records = await healthService.getNutritionRecords(req.user);
    return ApiResponse.success(res, records);
  }

  async getPersonnelNutritionHistory(req: Request, res: Response) {
    const identifier = req.params.identifier;
    const history = await healthService.getPersonnelNutritionHistory(identifier, req.user);
    return ApiResponse.success(res, history);
  }

  async saveNutritionRecord(req: Request, res: Response) {
    const result = await healthService.saveNutritionRecord(req.body, req.user);
    broadcastDataMutation('nutritionRecords', 'upsert', result);
    return ApiResponse.success(res, result, { message: 'پرونده و برنامه مشاوره تغذیه با موفقیت ثبت شد.' }, 201);
  }

  async deleteNutritionRecord(req: Request, res: Response) {
    const result = await healthService.deleteNutritionRecord(req.params.id, req.user);
    broadcastDataMutation('nutritionRecords', 'delete', { id: req.params.id });
    return ApiResponse.success(res, result, { message: 'پرونده مشاوره تغذیه حذف گردید.' });
  }
}

export const healthController = new HealthController();
