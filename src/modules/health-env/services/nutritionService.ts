import { 
  NutritionRecord, 
  NutritionStatistics, 
  NutritionFilterState,
  NutritionBmiCategory,
  DietGoal
} from '../types/nutritionTypes';
import { apiDatabaseClient, authFetch } from '../../../services/apiDatabaseClient';

class NutritionService {
  /**
   * Fetch all nutrition records directly from پایگاه داده
   */
  async getRecords(): Promise<NutritionRecord[]> {
    try {
      const res = await authFetch('/api/v1/health-exams/nutrition/records');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // fallback
    }

    try {
      const list = await apiDatabaseClient.getNutritionRecords();
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('Failed to get nutrition records from پایگاه داده:', err);
      return [];
    }
  }

  /**
   * Fetch personnel nutrition history across all consultations
   */
  async getPersonnelHistory(identifier: string): Promise<NutritionRecord[]> {
    if (!identifier) return [];
    try {
      const res = await authFetch(`/api/v1/health-exams/nutrition/personnel/${encodeURIComponent(identifier)}/history`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // fallback
    }

    const all = await this.getRecords();
    const clean = String(identifier).trim().toLowerCase();
    return all.filter(r => 
      String(r.personnelCode || '').trim().toLowerCase() === clean ||
      String(r.nationalCode || '').trim().toLowerCase() === clean ||
      String(r.personnelId || '').trim().toLowerCase() === clean
    );
  }

  /**
   * Save (create or update) a nutrition consultation record in پایگاه داده
   */
  async saveRecord(record: Partial<NutritionRecord>, currentUser?: any): Promise<NutritionRecord> {
    try {
      const res = await authFetch('/api/v1/health-exams/nutrition/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          window.dispatchEvent(new CustomEvent('hse_nutrition_records_updated', { detail: json.data }));
          window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'nutritionRecords' } }));
          return json.data;
        }
      }
    } catch {
      // fallback
    }

    const currentList = await this.getRecords();
    const nowIso = new Date().toISOString();
    const recordId = record.id || `nut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let recordNumber = record.recordNumber;
    if (!recordNumber) {
      const datePart = (record.visitDate || '').replace(/\D/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      recordNumber = `NUT-${datePart}-${randomSeq}`;
    }

    // Auto-calculate BMI
    const heightCm = Number(record.height) || 0;
    const weightKg = Number(record.weight) || 0;
    let bmi = record.bmi;
    let bmiCategory = record.bmiCategory || 'normal';
    if (heightCm > 0 && weightKg > 0) {
      const hM = heightCm / 100;
      bmi = Number((weightKg / (hM * hM)).toFixed(1));
      bmiCategory = this.getBmiCategory(bmi);
    }

    // Auto-calculate WHR
    let whr = record.whr;
    const waist = Number(record.waistCircumference);
    const hip = Number(record.hipCircumference);
    if (waist > 0 && hip > 0) {
      whr = Number((waist / hip).toFixed(2));
    }

    const fullRecord: NutritionRecord = {
      id: recordId,
      recordNumber,
      visitDate: record.visitDate || '',
      visitTime: record.visitTime || '',
      shift: record.shift || 'عادی‌کار',
      personnelId: record.personnelId,
      personnelCode: record.personnelCode || '',
      nationalCode: record.nationalCode || '',
      fullName: record.fullName || '',
      unit: record.unit || '',
      department: record.department,
      jobTitle: record.jobTitle || '',
      gender: record.gender,
      age: record.age,
      phone: record.phone,
      height: heightCm,
      weight: weightKg,
      bmi: bmi || 0,
      bmiCategory,
      waistCircumference: waist || undefined,
      hipCircumference: hip || undefined,
      whr: whr || undefined,
      bodyFatPercentage: record.bodyFatPercentage,
      systolicBp: record.systolicBp,
      diastolicBp: record.diastolicBp,
      waterIntakeLiters: record.waterIntakeLiters,
      fruitVeggieServings: record.fruitVeggieServings,
      fastFoodFrequency: record.fastFoodFrequency || 'rarely',
      sugaryDrinksFrequency: record.sugaryDrinksFrequency || 'rarely',
      saltIntake: record.saltIntake || 'moderate',
      fatOilPreference: record.fatOilPreference || 'olive_liquid',
      mealTimingPattern: record.mealTimingPattern || 'regular_3_meals',
      caffeineIntake: record.caffeineIntake || 'moderate',
      physicalActivityLevel: record.physicalActivityLevel || 'light',
      dietaryHabitNotes: record.dietaryHabitNotes,
      fbs: record.fbs,
      cholesterol: record.cholesterol,
      triglycerides: record.triglycerides,
      hdl: record.hdl,
      ldl: record.ldl,
      fattyLiverGrade: record.fattyLiverGrade || 'none',
      uricAcid: record.uricAcid,
      underlyingConditions: record.underlyingConditions || [],
      dietGoal: record.dietGoal || 'general_wellness',
      targetWeight: record.targetWeight,
      dailyCalorieTarget: record.dailyCalorieTarget,
      dietPlanSummary: record.dietPlanSummary || '',
      recommendations: record.recommendations || [],
      supplements: record.supplements,
      consultationType: record.consultationType || 'initial_assessment',
      consultantName: record.consultantName || currentUser?.name || 'کارشناس تغذیه',
      consultationNotes: record.consultationNotes || '',
      followUpStatus: record.followUpStatus || 'pending',
      nextFollowUpDate: record.nextFollowUpDate,
      priority: record.priority || 'routine',
      createdAt: record.createdAt || nowIso,
      createdBy: record.createdBy || currentUser?.username || 'کارشناس تغذیه',
      updatedAt: nowIso,
      updatedBy: currentUser?.username || 'کارشناس تغذیه'
    };

    const existingIndex = currentList.findIndex(r => r.id === recordId);
    let updatedList: NutritionRecord[];
    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = fullRecord;
    } else {
      updatedList = [fullRecord, ...currentList];
    }

    await apiDatabaseClient.saveNutritionRecords(updatedList);
    window.dispatchEvent(new CustomEvent('hse_nutrition_records_updated', { detail: fullRecord }));
    window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'nutritionRecords' } }));
    return fullRecord;
  }

  /**
   * Delete a nutrition record from پایگاه داده
   */
  async deleteRecord(id: string): Promise<boolean> {
    try {
      const res = await authFetch(`/api/v1/health-exams/nutrition/records/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'nutritionRecords' } }));
        return true;
      }
    } catch {
      // fallback
    }

    const currentList = await this.getRecords();
    const updated = currentList.filter(r => r.id !== id);
    await apiDatabaseClient.saveNutritionRecords(updated);
    window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'nutritionRecords' } }));
    return true;
  }

  /**
   * Calculate BMI Category strictly according to WHO standards
   */
  getBmiCategory(bmi: number): NutritionBmiCategory {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25) return 'normal';
    if (bmi < 30) return 'overweight';
    if (bmi < 35) return 'obese_1';
    if (bmi < 40) return 'obese_2';
    return 'obese_3';
  }

  /**
   * Calculate Real Statistics strictly from database records (Zero Fake Data)
   */
  calculateStatistics(records: NutritionRecord[]): NutritionStatistics {
    if (!records || records.length === 0) {
      return {
        totalRecords: 0,
        totalUniquePersonnel: 0,
        bmiDistribution: {
          underweight: 0,
          normal: 0,
          overweight: 0,
          obese: 0
        },
        fattyLiverDistribution: {
          none: 0,
          grade_1: 0,
          grade_2: 0,
          grade_3: 0
        },
        priorityDistribution: {
          routine: 0,
          high_risk: 0,
          urgent: 0
        },
        activeFollowUpsCount: 0,
        highRiskCount: 0,
        topGoals: [],
        unitBreakdown: []
      };
    }

    const uniquePersons = new Set<string>();
    const bmiCounts = { underweight: 0, normal: 0, overweight: 0, obese: 0 };
    const flCounts = { none: 0, grade_1: 0, grade_2: 0, grade_3: 0 };
    const priorityCounts = { routine: 0, high_risk: 0, urgent: 0 };
    const goalsMap: Record<string, number> = {};
    const unitMap: Record<string, number> = {};
    let activeFollowUps = 0;
    let highRisk = 0;

    records.forEach(r => {
      if (r.personnelCode) {
        uniquePersons.add(r.personnelCode);
      }

      // BMI
      if (r.bmiCategory === 'underweight') bmiCounts.underweight++;
      else if (r.bmiCategory === 'normal') bmiCounts.normal++;
      else if (r.bmiCategory === 'overweight') bmiCounts.overweight++;
      else if (['obese_1', 'obese_2', 'obese_3'].includes(r.bmiCategory)) bmiCounts.obese++;

      // Fatty Liver
      if (r.fattyLiverGrade === 'grade_1') flCounts.grade_1++;
      else if (r.fattyLiverGrade === 'grade_2') flCounts.grade_2++;
      else if (r.fattyLiverGrade === 'grade_3') flCounts.grade_3++;
      else flCounts.none++;

      // Priority
      if (r.priority === 'urgent') priorityCounts.urgent++;
      else if (r.priority === 'high_risk') priorityCounts.high_risk++;
      else priorityCounts.routine++;

      // Follow-up
      if (r.followUpStatus === 'pending' || r.followUpStatus === 'in_progress') {
        activeFollowUps++;
      }

      // High Risk criteria
      if (
        r.priority === 'urgent' || 
        r.priority === 'high_risk' || 
        r.bmi >= 30 || 
        r.fattyLiverGrade === 'grade_2' || 
        r.fattyLiverGrade === 'grade_3'
      ) {
        highRisk++;
      }

      // Goals
      if (r.dietGoal) {
        goalsMap[r.dietGoal] = (goalsMap[r.dietGoal] || 0) + 1;
      }

      // Unit
      const u = r.unit || 'نامشخص';
      unitMap[u] = (unitMap[u] || 0) + 1;
    });

    const topGoals = Object.entries(goalsMap)
      .map(([goal, count]) => ({ goal: goal as DietGoal, count }))
      .sort((a, b) => b.count - a.count);

    const unitBreakdown = Object.entries(unitMap)
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRecords: records.length,
      totalUniquePersonnel: uniquePersons.size,
      bmiDistribution: bmiCounts,
      fattyLiverDistribution: flCounts,
      priorityDistribution: priorityCounts,
      activeFollowUpsCount: activeFollowUps,
      highRiskCount: highRisk,
      topGoals,
      unitBreakdown
    };
  }

  /**
   * Filter records based on state
   */
  filterRecords(records: NutritionRecord[], filters: NutritionFilterState): NutritionRecord[] {
    return records.filter(r => {
      // Query
      if (filters.searchQuery) {
        const q = filters.searchQuery.trim().toLowerCase();
        const match = 
          (r.fullName && r.fullName.toLowerCase().includes(q)) ||
          (r.personnelCode && r.personnelCode.toLowerCase().includes(q)) ||
          (r.nationalCode && r.nationalCode.toLowerCase().includes(q)) ||
          (r.recordNumber && r.recordNumber.toLowerCase().includes(q)) ||
          (r.jobTitle && r.jobTitle.toLowerCase().includes(q));
        if (!match) return false;
      }

      // Unit
      if (filters.unit && r.unit !== filters.unit) {
        return false;
      }

      // BMI
      if (filters.bmiCategory && filters.bmiCategory !== 'all') {
        if (filters.bmiCategory === 'obese') {
          if (!['obese_1', 'obese_2', 'obese_3'].includes(r.bmiCategory)) return false;
        } else if (r.bmiCategory !== filters.bmiCategory) {
          return false;
        }
      }

      // Diet Goal
      if (filters.dietGoal && filters.dietGoal !== 'all' && r.dietGoal !== filters.dietGoal) {
        return false;
      }

      // Priority
      if (filters.priority && filters.priority !== 'all' && r.priority !== filters.priority) {
        return false;
      }

      // Follow-up status
      if (filters.followUpStatus && filters.followUpStatus !== 'all' && r.followUpStatus !== filters.followUpStatus) {
        return false;
      }

      // Fatty Liver Grade
      if (filters.fattyLiverGrade && filters.fattyLiverGrade !== 'all' && r.fattyLiverGrade !== filters.fattyLiverGrade) {
        return false;
      }

      // Date range
      if (filters.dateFrom && r.visitDate < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && r.visitDate > filters.dateTo) {
        return false;
      }

      return true;
    });
  }
}

export const nutritionService = new NutritionService();
