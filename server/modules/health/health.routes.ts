import { Router } from 'express';
import { healthController } from './health.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/exam/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), (req, res, next) => {
  healthController.getExamDetails(req, res).catch(next);
});

router.get('/personnel/:identifier/history', requireAuth, (req, res, next) => {
  const userRole = (req.user?.role || 'USER').toUpperCase();
  const isMedicalStaff = ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'].includes(userRole);
  const identifier = req.params.identifier;
  const isOwnRecord = req.user?.personnelCode === identifier || req.user?.uid === identifier;
  if (!isMedicalStaff && !isOwnRecord) {
    return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده پرونده سلامت این پرسنل نیستید.' });
  }
  healthController.getPersonnelHistory(req, res).catch(next);
});

router.post('/exam', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), (req, res, next) => {
  healthController.saveExam(req, res).catch(next);
});

router.get('/exam/:id/a4-fitness-card', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), (req, res, next) => {
  healthController.getA4FitnessCard(req, res).catch(next);
});

// ==========================================
// Clinic & Dispensary (بهداری) Endpoints
// ==========================================
router.get('/clinic/visits', requireAuth, (req, res, next) => {
  healthController.getClinicVisits(req, res).catch(next);
});

router.get('/clinic/personnel/:identifier/history', requireAuth, (req, res, next) => {
  const userRole = (req.user?.role || 'USER').toUpperCase();
  const isMedicalStaff = ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL', 'CLINIC_MEDIC', 'HSE_EXPERT'].includes(userRole);
  const identifier = req.params.identifier;
  const isOwnRecord = req.user?.personnelCode === identifier || req.user?.uid === identifier;
  if (!isMedicalStaff && !isOwnRecord) {
    return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده پرونده سلامت این پرسنل نیستید.' });
  }
  healthController.getPersonnelClinicHistory(req, res).catch(next);
});

router.post('/clinic/visits', requireAuth, (req, res, next) => {
  healthController.saveClinicVisit(req, res).catch(next);
});

router.delete('/clinic/visits/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), (req, res, next) => {
  healthController.deleteClinicVisit(req, res).catch(next);
});

// ==========================================
// Nutrition Specialist (کارشناس تغذیه) Endpoints
// ==========================================
router.get('/nutrition/records', requireAuth, (req, res, next) => {
  healthController.getNutritionRecords(req, res).catch(next);
});

router.get('/nutrition/personnel/:identifier/history', requireAuth, (req, res, next) => {
  const userRole = (req.user?.role || 'USER').toUpperCase();
  const isNutritionStaff = ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL', 'NUTRITIONIST', 'NUTRITION_EXPERT', 'MEDICAL_STAFF', 'HSE_EXPERT'].includes(userRole);
  const identifier = req.params.identifier;
  const isOwnRecord = req.user?.personnelCode === identifier || req.user?.uid === identifier;
  if (!isNutritionStaff && !isOwnRecord) {
    return res.status(403).json({ success: false, error: 'شما مجاز به مشاهده سوابق تغذیه این پرسنل نیستید.' });
  }
  healthController.getPersonnelNutritionHistory(req, res).catch(next);
});

router.post('/nutrition/records', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL', 'NUTRITIONIST', 'NUTRITION_EXPERT', 'MEDICAL_STAFF'), (req, res, next) => {
  healthController.saveNutritionRecord(req, res).catch(next);
});

router.delete('/nutrition/records/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'NUTRITIONIST', 'NUTRITION_EXPERT'), (req, res, next) => {
  healthController.deleteNutritionRecord(req, res).catch(next);
});

export default router;
