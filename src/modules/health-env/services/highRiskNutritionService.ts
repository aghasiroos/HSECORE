import { 
  HighRiskPersonnelProfile, 
  HighRiskCategoryMatch, 
  NutritionRecord,
  FattyLiverGrade,
  NutritionBmiCategory,
  HighRiskCategoryType
} from '../types/nutritionTypes';
import { PeriodicMedicalExam, PeriodicMedicalRecord, MedicalTestResultRecord } from '../types';
import { ComplexPersonnel } from '../../../utils/personnelHelper';
import { normalizeDigits } from '../../../utils/textNormalization';

export class HighRiskNutritionService {
  /**
   * Parse Jalali date "YYYY/MM/DD" or "YYYY-MM-DD" into comparable integer YYYYMMDD
   */
  private parseJalaliToInt(jDate?: string): number {
    if (!jDate) return 0;
    const clean = normalizeDigits(String(jDate)).replace(/[^\d]/g, '');
    if (clean.length >= 8) {
      return parseInt(clean.slice(0, 8), 10);
    }
    return 0;
  }

  /**
   * Determine BMI Category based on WHO & National Occupational Health standard
   */
  public getBmiCategory(bmi: number): NutritionBmiCategory {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25.0) return 'normal';
    if (bmi < 30.0) return 'overweight';
    if (bmi < 35.0) return 'obese_1';
    if (bmi < 40.0) return 'obese_2';
    return 'obese_3';
  }

  /**
   * Extract fatty liver grade from free-text medical findings, ultrasound, or notes
   */
  private detectFattyLiverFromText(text?: string): FattyLiverGrade {
    if (!text) return 'none';
    const lower = text.toLowerCase();
    if (
      lower.includes('گرید ۳') || 
      lower.includes('گرید 3') || 
      lower.includes('grade 3') || 
      lower.includes('grade iii') || 
      lower.includes('استئاتوز شدید')
    ) {
      return 'grade_3';
    }
    if (
      lower.includes('گرید ۲') || 
      lower.includes('گرید 2') || 
      lower.includes('grade 2') || 
      lower.includes('grade ii') || 
      lower.includes('استئاتوز متوسط')
    ) {
      return 'grade_2';
    }
    if (
      lower.includes('گرید ۱') || 
      lower.includes('گرید 1') || 
      lower.includes('grade 1') || 
      lower.includes('grade i') || 
      lower.includes('استئاتوز خفیف')
    ) {
      return 'grade_1';
    }
    return 'none';
  }

  /**
   * Extract numeric lab value from unstructured text using multiple patterns
   */
  private extractLabValueFromText(text: string, testRegexPattern: string): number | undefined {
    if (!text) return undefined;
    const clean = normalizeDigits(text);
    const pattern = new RegExp(`(?:${testRegexPattern})[\\s:=]+([\\d]+(?:\\.[\\d]+)?)`, 'i');
    const m = clean.match(pattern);
    if (m && m[1]) {
      const val = parseFloat(m[1]);
      if (!isNaN(val) && val > 0) return val;
    }
    return undefined;
  }

  /**
   * Parse Blood Pressure systolic and diastolic from string like "140/90", "14/9", "130-85"
   */
  private parseBloodPressure(bpStr?: string): { sys?: number; dia?: number } {
    if (!bpStr) return {};
    const clean = normalizeDigits(String(bpStr)).trim();
    const m = clean.match(/(\d{2,3})\s*[/_.-]\s*(\d{2,3})/);
    if (m) {
      let sys = parseInt(m[1], 10);
      let dia = parseInt(m[2], 10);
      // Normalize Persian clinical shorthand where 14/9 means 140/90
      if (sys > 0 && sys < 30) sys = sys * 10;
      if (dia > 0 && dia < 30) dia = dia * 10;
      if (sys >= 60 && sys <= 280 && dia >= 40 && dia <= 180) {
        return { sys, dia };
      }
    }
    return {};
  }

  /**
   * Build unified, deduplicated list of high-risk personnel across Periodic Medical Exams and Nutrition records
   */
  public buildHighRiskProfiles(
    nutritionRecords: NutritionRecord[] = [],
    periodicExams: PeriodicMedicalExam[] = [],
    periodicRecords: PeriodicMedicalRecord[] = [],
    masterPersonnel: ComplexPersonnel[] = [],
    todayJalali: string = '',
    structuredLabResults: MedicalTestResultRecord[] = []
  ): HighRiskPersonnelProfile[] {
    const todayInt = this.parseJalaliToInt(todayJalali);

    const normKey = (c?: any): string => {
      if (!c) return '';
      return normalizeDigits(String(c)).trim().toLowerCase();
    };

    // Map personnel by code and national ID for fast lookup
    const personnelMap = new Map<string, ComplexPersonnel>();
    masterPersonnel.forEach(p => {
      const pCode = normKey(p.personnelCode);
      const eCode = normKey(p.employeeCode);
      const nCode = normKey(p.nationalCode);
      if (pCode) personnelMap.set(pCode, p);
      if (eCode) personnelMap.set(eCode, p);
      if (nCode) personnelMap.set(nCode, p);
    });

    // Map periodic records by employeeCode and nationalCode
    const periodicRecordMap = new Map<string, PeriodicMedicalRecord>();
    periodicRecords.forEach(pr => {
      const code = normKey(pr.employeeCode);
      const nCode = normKey(pr.nationalCode);
      if (code) periodicRecordMap.set(code, pr);
      if (nCode) periodicRecordMap.set(nCode, pr);
    });

    // Group periodic exams by employeeCode & nationalCode, sorted by examYear/examDate descending
    const examsByPersonnel = new Map<string, PeriodicMedicalExam[]>();
    periodicExams.forEach(exam => {
      const code = normKey(exam.employeeCode);
      if (!code) return;
      const list = examsByPersonnel.get(code) || [];
      list.push(exam);
      examsByPersonnel.set(code, list);

      const nCode = normKey((exam as any).nationalCode || (exam as any).nid);
      if (nCode && nCode !== code) {
        const nList = examsByPersonnel.get(nCode) || [];
        nList.push(exam);
        examsByPersonnel.set(nCode, nList);
      }
    });

    // Sort exams descending for each employee
    examsByPersonnel.forEach((list) => {
      list.sort((a, b) => {
        if (b.examYear !== a.examYear) return (b.examYear || 0) - (a.examYear || 0);
        return (b.examDate || '').localeCompare(a.examDate || '');
      });
    });

    // Group nutrition records by personnelCode & nationalCode, sorted by visitDate descending
    const nutritionByPersonnel = new Map<string, NutritionRecord[]>();
    nutritionRecords.forEach(rec => {
      const code = normKey(rec.personnelCode);
      const nCode = normKey(rec.nationalCode);
      if (code) {
        const list = nutritionByPersonnel.get(code) || [];
        list.push(rec);
        nutritionByPersonnel.set(code, list);
      }
      if (nCode && nCode !== code) {
        const nList = nutritionByPersonnel.get(nCode) || [];
        nList.push(rec);
        nutritionByPersonnel.set(nCode, nList);
      }
    });

    // Sort nutrition records descending
    nutritionByPersonnel.forEach((list) => {
      list.sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
    });

    // Group structured lab results by personnelCode / nationalCode
    const labResultsByPersonnel = new Map<string, MedicalTestResultRecord[]>();
    structuredLabResults.forEach(res => {
      const code = normKey(res.personnelCode);
      const nCode = normKey(res.nationalCode);
      if (code) {
        const list = labResultsByPersonnel.get(code) || [];
        list.push(res);
        labResultsByPersonnel.set(code, list);
      }
      if (nCode && nCode !== code) {
        const nList = labResultsByPersonnel.get(nCode) || [];
        nList.push(res);
        labResultsByPersonnel.set(nCode, nList);
      }
    });

    // Collect all candidate keys (all personnel codes present in exams, nutrition, master list, or lab tests)
    const allCandidateCodes = new Set<string>();
    examsByPersonnel.forEach((_, k) => allCandidateCodes.add(k));
    nutritionByPersonnel.forEach((_, k) => allCandidateCodes.add(k));
    labResultsByPersonnel.forEach((_, k) => allCandidateCodes.add(k));

    const highRiskProfiles: HighRiskPersonnelProfile[] = [];
    const processedPersonKeys = new Set<string>();

    allCandidateCodes.forEach(rawCode => {
      const pRecord = periodicRecordMap.get(rawCode);
      const masterP = personnelMap.get(rawCode);
      const pExams = examsByPersonnel.get(rawCode) || [];
      const pNutritions = nutritionByPersonnel.get(rawCode) || [];
      const pLabs = labResultsByPersonnel.get(rawCode) || [];

      // 1. Strict Personnel Integrity Check:
      // Only skip if the person was explicitly marked as deleted in the central personnel directory or medical records
      if (masterP && ((masterP as any).isDeleted || (masterP as any).status === 'deleted')) {
        return; // Skip explicitly deleted personnel!
      }
      if (pRecord && ((pRecord as any).isDeleted || (pRecord as any).status === 'deleted')) {
        return; // Skip explicitly deleted medical record!
      }

      // 2. Periodic Exam / Source Integrity Check:
      // If periodic exams Excel was deleted, check if any exams or lab tests or valid standalone nutrition data remain
      const latestNutrition = pNutritions[0] || null;
      const hasIndependentNutritionData = Boolean(
        latestNutrition && 
        ((latestNutrition.bmi && latestNutrition.bmi > 0) || 
         (latestNutrition.systolicBp && latestNutrition.systolicBp > 0) || 
         (latestNutrition.fbs && latestNutrition.fbs > 0) ||
         (latestNutrition.fattyLiverGrade && latestNutrition.fattyLiverGrade !== 'none'))
      );

      if (pExams.length === 0 && pLabs.length === 0 && !hasIndependentNutritionData) {
        return; // All periodic exams / Excel deleted and no standalone nutrition record -> omit!
      }

      const latestExam = pExams[0] || null;

      // Extract primary identities
      const personnelCode = masterP?.personnelCode || masterP?.employeeCode || pRecord?.employeeCode || latestNutrition?.personnelCode || latestExam?.employeeCode || rawCode;
      const nationalCode = masterP?.nationalCode || pRecord?.nationalCode || latestNutrition?.nationalCode || (latestExam as any)?.nationalCode || (latestExam as any)?.nid || '';

      // Deduplicate by normalized identity key so one individual is only processed once
      const primaryKey = normKey(personnelCode || nationalCode || rawCode);
      if (!primaryKey || processedPersonKeys.has(primaryKey)) {
        return;
      }
      processedPersonKeys.add(primaryKey);
      if (nationalCode) {
        processedPersonKeys.add(normKey(nationalCode));
      }

      const fullName = masterP?.fullName || (pRecord?.firstName && pRecord?.lastName ? `${pRecord.firstName} ${pRecord.lastName}` : '') || latestNutrition?.fullName || (latestExam as any)?.employeeName || (latestExam as any)?.fullName || `پرسنل کد ${personnelCode}`;
      const unit = masterP?.unit || masterP?.department || pRecord?.department || latestNutrition?.unit || (latestExam as any)?.department || (latestExam as any)?.company || 'سازمان مرکزی';
      const department = masterP?.department || pRecord?.department || latestNutrition?.department || (latestExam as any)?.department;
      const jobTitle = masterP?.jobTitle || masterP?.position || pRecord?.jobTitle || latestNutrition?.jobTitle || (latestExam as any)?.jobTitle || (latestExam as any)?.job_title || 'پرسنل شاغل';
      const phone = masterP?.phone || masterP?.mobile || pRecord?.phone || latestNutrition?.phone;
      const gender = masterP?.gender || latestNutrition?.gender || (latestExam as any)?.gender || 'MALE';
      const age = masterP?.age || pRecord?.age || latestNutrition?.age || (latestExam as any)?.age;

      // Height, Weight, BMI Synthesis
      let height = latestNutrition?.height || latestExam?.findings?.heightCm || (latestExam as any)?.height || (latestExam as any)?.heightCm || 0;
      let weight = latestNutrition?.weight || latestExam?.findings?.weightKg || (latestExam as any)?.weight || (latestExam as any)?.weightKg || 0;
      let bmi = latestNutrition?.bmi || latestExam?.findings?.bmi || (latestExam as any)?.bmi || 0;

      if ((!bmi || bmi <= 0) && height > 0 && weight > 0) {
        const hM = height / 100;
        bmi = Number((weight / (hM * hM)).toFixed(1));
      }

      // Fatty Liver Synthesis
      let fattyLiverGrade: FattyLiverGrade = latestNutrition?.fattyLiverGrade || 'none';
      let fattyLiverDetails = '';

      if (fattyLiverGrade === 'none' && latestExam) {
        const fullExamText = [
          latestExam.findings?.generalConclusion,
          latestExam.findings?.bloodTests,
          latestExam.recommendations,
          latestExam.description,
          (latestExam as any)?.clinicalNotes,
          (latestExam as any)?.dis_nonocc_known,
          (latestExam as any)?.dis_nonocc_new,
          (latestExam as any)?.nutr_advice,
          (latestExam as any)?.final_advice
        ].filter(Boolean).join(' ');

        const detected = this.detectFattyLiverFromText(fullExamText);
        if (detected !== 'none') {
          fattyLiverGrade = detected;
          fattyLiverDetails = 'تشخیص داده شده در معاینات ادواری طب کار';
        }
      }

      // Blood Pressure & Vitals Synthesis
      let systolicBp = latestNutrition?.systolicBp || (latestExam as any)?.systolicBp || (latestExam as any)?.bp_sys;
      let diastolicBp = latestNutrition?.diastolicBp || (latestExam as any)?.diastolicBp || (latestExam as any)?.bp_dia;
      let bpMeasurementDate: string | undefined = latestNutrition?.systolicBp ? latestNutrition?.visitDate : latestExam?.examDate;
      
      if ((!systolicBp || !diastolicBp) && latestExam?.findings?.bloodPressure) {
        const parsed = this.parseBloodPressure(latestExam.findings.bloodPressure);
        if (parsed.sys && parsed.dia) {
          systolicBp = parsed.sys;
          diastolicBp = parsed.dia;
          bpMeasurementDate = latestExam.examDate;
        }
      }

      // If still missing, check in exam history
      if (!systolicBp && pExams.length > 1) {
        for (let i = 1; i < pExams.length; i++) {
          const ex = pExams[i];
          if ((ex as any)?.bp_sys && (ex as any)?.bp_dia) {
            systolicBp = (ex as any).bp_sys;
            diastolicBp = (ex as any).bp_dia;
            bpMeasurementDate = ex.examDate;
            break;
          }
          if (ex.findings?.bloodPressure) {
            const parsed = this.parseBloodPressure(ex.findings.bloodPressure);
            if (parsed.sys && parsed.dia) {
              systolicBp = parsed.sys;
              diastolicBp = parsed.dia;
              bpMeasurementDate = ex.examDate;
              break;
            }
          }
        }
      }

      // Blood Glucose & Biomarkers Synthesis
      let fbs = latestNutrition?.fbs ?? (Number((latestExam as any)?.fbs) || undefined);
      let randomBs = Number((latestExam as any)?.randomBs || (latestExam as any)?.bloodSugar) || undefined;
      let hba1c = Number((latestExam as any)?.hba1c) || undefined;

      let bloodSugarTestType: 'FBS' | 'BS' | 'HbA1c' | undefined = undefined;
      let bloodSugarValue: number | undefined = undefined;
      let bloodSugarUnit: string = 'mg/dL';
      let bloodSugarMeasurementDate: string | undefined = undefined;
      const bmiMeasurementDate: string | undefined = latestNutrition?.visitDate || latestExam?.examDate;

      // Extract from free-text lab results if not directly present
      if (latestExam?.findings?.bloodTests) {
        const labText = latestExam.findings.bloodTests;
        if (!fbs) {
          fbs = this.extractLabValueFromText(labText, 'fbs|قند\\s*ناشتا|fasting\\s*blood\\s*sugar');
        }
        if (!randomBs) {
          randomBs = this.extractLabValueFromText(labText, 'bs|rbs|قند\\s*تصادفی|random\\s*sugar');
        }
        if (!hba1c) {
          hba1c = this.extractLabValueFromText(labText, 'hba1c|a1c|هموگلوبین\\s*a1c');
        }
      }

      let cholesterol = latestNutrition?.cholesterol ?? (Number((latestExam as any)?.chol) || undefined);
      let triglycerides = latestNutrition?.triglycerides ?? (Number((latestExam as any)?.tg) || undefined);

      // Synthesize directly from Structured Laboratory Tests (تب آزمایشگاه)
      let hasIndeterminateLabResults = false;
      let indeterminateLabDetails = '';

      pLabs.forEach(test => {
        const itemCodeUpper = (test.itemCode || '').toUpperCase().trim();
        const itemNameLower = (test.itemName || '').toLowerCase().trim();
        const numVal = typeof test.valueNumeric === 'number' && !isNaN(test.valueNumeric) ? test.valueNumeric : undefined;

        // Check for indeterminate / missing units / ambiguous results needing review
        if (
          (test.status as string) === 'RequiresMedicalReview' ||
          test.status === 'Pending' ||
          (!test.unit && (itemCodeUpper === 'FBS' || itemCodeUpper === 'HBA1C' || itemCodeUpper === 'CHOL')) ||
          (numVal === undefined && test.valueText && /نامشخص|مشکوک|تکرار|بررسی|ناخوانا/i.test(test.valueText))
        ) {
          hasIndeterminateLabResults = true;
          indeterminateLabDetails = `نتیجه آزمایش «${test.itemName || test.itemCode}» فاقد اطلاعات معتبر یا دارای واحد نامشخص بوده و نیازمند بررسی است.`;
        }

        // Fasting Blood Sugar (FBS) - clinical validation range 40-600 mg/dL
        if (itemCodeUpper === 'FBS' || itemNameLower.includes('قند ناشتا') || itemNameLower.includes('fbs')) {
          if (numVal && numVal >= 40 && numVal <= 600) {
            fbs = numVal;
            bloodSugarTestType = 'FBS';
            bloodSugarValue = numVal;
            bloodSugarUnit = test.unit || 'mg/dL';
            bloodSugarMeasurementDate = test.examDate;
          }
        }

        // HbA1c - clinical validation range 3.0-20.0 %
        if (itemCodeUpper === 'HBA1C' || itemCodeUpper === 'A1C' || itemNameLower.includes('hba1c') || itemNameLower.includes('a1c')) {
          if (numVal && numVal >= 3.0 && numVal <= 20.0) {
            hba1c = numVal;
            if (!bloodSugarTestType || bloodSugarTestType === 'BS') {
              bloodSugarTestType = 'HbA1c';
              bloodSugarValue = numVal;
              bloodSugarUnit = test.unit || '%';
              bloodSugarMeasurementDate = test.examDate;
            }
          }
        }

        // Random Blood Sugar - clinical validation range 40-700 mg/dL
        if (itemCodeUpper === 'BS' || itemCodeUpper === 'RBS' || itemNameLower.includes('قند تصادفی') || itemNameLower.includes('rbs')) {
          if (numVal && numVal >= 40 && numVal <= 700) {
            randomBs = numVal;
            if (!bloodSugarTestType) {
              bloodSugarTestType = 'BS';
              bloodSugarValue = numVal;
              bloodSugarUnit = test.unit || 'mg/dL';
              bloodSugarMeasurementDate = test.examDate;
            }
          }
        }

        // Systolic BP
        if (itemCodeUpper === 'BP_SYS' || itemNameLower.includes('سیستولیک')) {
          if (numVal && numVal >= 60 && numVal <= 280) {
            systolicBp = numVal;
            bpMeasurementDate = test.examDate;
          }
        }

        // Diastolic BP
        if (itemCodeUpper === 'BP_DIA' || itemNameLower.includes('دیاستولیک')) {
          if (numVal && numVal >= 40 && numVal <= 180) {
            diastolicBp = numVal;
            if (!bpMeasurementDate) bpMeasurementDate = test.examDate;
          }
        }

        // BMI
        if (itemCodeUpper === 'BMI' || itemNameLower.includes('شاخص توده بدنی')) {
          if (numVal && numVal >= 12 && numVal <= 80) bmi = numVal;
        }

        // Cholesterol
        if (itemCodeUpper === 'CHOL' || itemCodeUpper === 'CHOLESTEROL' || itemNameLower.includes('کلسترول')) {
          if (numVal && numVal > 0) cholesterol = numVal;
        }

        // Triglycerides
        if (itemCodeUpper === 'TG' || itemCodeUpper === 'TRIGLYCERIDES' || itemNameLower.includes('تری‌گلیسرید')) {
          if (numVal && numVal > 0) triglycerides = numVal;
        }
      });

      // Fallback identification of blood sugar test type and unit
      if (!bloodSugarTestType) {
        if (fbs) {
          bloodSugarTestType = 'FBS';
          bloodSugarValue = fbs;
          bloodSugarUnit = 'mg/dL';
          bloodSugarMeasurementDate = latestNutrition?.fbs ? latestNutrition.visitDate : latestExam?.examDate;
        } else if (hba1c) {
          bloodSugarTestType = 'HbA1c';
          bloodSugarValue = hba1c;
          bloodSugarUnit = '%';
          bloodSugarMeasurementDate = latestExam?.examDate;
        } else if (randomBs) {
          bloodSugarTestType = 'BS';
          bloodSugarValue = randomBs;
          bloodSugarUnit = 'mg/dL';
          bloodSugarMeasurementDate = latestExam?.examDate;
        }
      }

      const bmiCategory = this.getBmiCategory(bmi);

      // Blood Pressure Classification (AHA / National Guidelines)
      let bloodPressureStage: 'normal' | 'prehypertension' | 'stage_1' | 'stage_2' | 'crisis' = 'normal';
      if (systolicBp && diastolicBp) {
        if (systolicBp >= 180 || diastolicBp >= 110) {
          bloodPressureStage = 'crisis';
        } else if (systolicBp >= 160 || diastolicBp >= 100) {
          bloodPressureStage = 'stage_2';
        } else if (systolicBp >= 140 || diastolicBp >= 90) {
          bloodPressureStage = 'stage_1';
        } else if (systolicBp >= 120 || diastolicBp >= 80) {
          bloodPressureStage = 'prehypertension';
        }
      }

      // Blood Sugar Stage Classification (ADA 2024 / Iranian Endocrine Guidelines)
      let bloodSugarStage: 'normal' | 'prediabetes' | 'diabetes' = 'normal';
      if ((fbs && fbs >= 126) || (randomBs && randomBs >= 200) || (hba1c && hba1c >= 6.5)) {
        bloodSugarStage = 'diabetes';
      } else if ((fbs && fbs >= 100) || (randomBs && randomBs >= 140) || (hba1c && hba1c >= 5.7)) {
        bloodSugarStage = 'prediabetes';
      }

      const underlyingConditions = Array.from(new Set([
        ...(latestNutrition?.underlyingConditions || []),
        ...(pRecord?.chronicConditions?.map(c => c.conditionName) || [])
      ]));

      // Follow-up status & due evaluation
      let followUpStatus = latestNutrition?.followUpStatus || 'pending';
      const nextFollowUpDate = latestNutrition?.nextFollowUpDate || (latestExam as any)?.final_followup_date || undefined;
      const nextFollowUpInt = this.parseJalaliToInt(nextFollowUpDate);
      const isFollowUpOverdue = Boolean(nextFollowUpInt > 0 && nextFollowUpInt <= todayInt);

      // ========================================================================
      // EVALUATE HIGH-RISK CRITERIA
      // ========================================================================
      const matches: HighRiskCategoryMatch[] = [];

      // ── 1. BMI Criteria (BMI >= 25 with subcategories) ──
      if (bmi >= 25) {
        if (bmi >= 40) {
          // Obese Grade 3 (Morbid Obesity)
          matches.push({
            category: 'bmi_obese_3',
            categoryLabelFa: 'چاقی درجه ۳ / مفرط (BMI >= 40)',
            severity: 'critical',
            detailsFa: `شاخص توده بدنی ${bmi} (چاقی مفرط درجه ۳ - خطر حاد قلبی، عروقی و متابولیک)`,
            valueBadge: `BMI: ${bmi}`,
            subType: 'obese_3'
          });
          // Also tag general obese
          matches.push({
            category: 'bmi_obese',
            categoryLabelFa: 'شاخص توده بدنی (BMI >= 30)',
            severity: 'critical',
            detailsFa: `شاخص توده بدنی ${bmi} (چاقی مفرط درجه ۳)`,
            valueBadge: `BMI: ${bmi}`
          });
        } else if (bmi >= 35) {
          // Obese Grade 2
          matches.push({
            category: 'bmi_obese_2',
            categoryLabelFa: 'چاقی درجه ۲ (BMI 35 - 39.9)',
            severity: 'high',
            detailsFa: `شاخص توده بدنی ${bmi} (چاقی درجه ۲ - نیازمند مداخله و اصلاح رژیم)`,
            valueBadge: `BMI: ${bmi}`,
            subType: 'obese_2'
          });
          matches.push({
            category: 'bmi_obese',
            categoryLabelFa: 'شاخص توده بدنی (BMI >= 30)',
            severity: 'high',
            detailsFa: `شاخص توده بدنی ${bmi} (چاقی درجه ۲)`,
            valueBadge: `BMI: ${bmi}`
          });
        } else if (bmi >= 30) {
          // Obese Grade 1
          matches.push({
            category: 'bmi_obese_1',
            categoryLabelFa: 'چاقی درجه ۱ (BMI 30 - 34.9)',
            severity: 'high',
            detailsFa: `شاخص توده بدنی ${bmi} (چاقی درجه ۱)`,
            valueBadge: `BMI: ${bmi}`,
            subType: 'obese_1'
          });
          matches.push({
            category: 'bmi_obese',
            categoryLabelFa: 'شاخص توده بدنی (BMI >= 30)',
            severity: 'high',
            detailsFa: `شاخص توده بدنی ${bmi} (چاقی درجه ۱)`,
            valueBadge: `BMI: ${bmi}`
          });
        } else {
          // Overweight (25 - 29.9)
          matches.push({
            category: 'bmi_overweight',
            categoryLabelFa: 'اضافه‌وزن (BMI 25 - 29.9)',
            severity: 'moderate',
            detailsFa: `شاخص توده بدنی ${bmi} (اضافه‌وزن - مستعد چاقی و سندرم متابولیک)`,
            valueBadge: `BMI: ${bmi}`,
            subType: 'overweight'
          });
        }
      }

      // ── 2. High Blood Pressure Criteria (فشار خون بالا) ──
      if (bloodPressureStage !== 'normal' && systolicBp && diastolicBp) {
        if (bloodPressureStage === 'crisis') {
          matches.push({
            category: 'hypertension',
            categoryLabelFa: 'بحران پرفشاری خون (Hypertensive Crisis)',
            severity: 'critical',
            detailsFa: `بحران پرفشاری خون (${systolicBp}/${diastolicBp} mmHg - اقدام اورژانسی و ارجاع تخصصی)`,
            valueBadge: `BP: ${systolicBp}/${diastolicBp}`,
            subType: 'crisis'
          });
        } else if (bloodPressureStage === 'stage_2') {
          matches.push({
            category: 'hypertension',
            categoryLabelFa: 'پرفشاری خون درجه ۲ (Stage 2)',
            severity: 'critical',
            detailsFa: `پرفشاری خون درجه ۲ (${systolicBp}/${diastolicBp} mmHg - نیازمند دارودرمانی و رژیم فشرده DASH)`,
            valueBadge: `BP: ${systolicBp}/${diastolicBp}`,
            subType: 'stage_2'
          });
        } else if (bloodPressureStage === 'stage_1') {
          matches.push({
            category: 'hypertension',
            categoryLabelFa: 'پرفشاری خون درجه ۱ (Stage 1)',
            severity: 'high',
            detailsFa: `پرفشاری خون درجه ۱ (${systolicBp}/${diastolicBp} mmHg - رژیم کاهش سدیم و پایش دوره‌ای)`,
            valueBadge: `BP: ${systolicBp}/${diastolicBp}`,
            subType: 'stage_1'
          });
        } else if (bloodPressureStage === 'prehypertension') {
          matches.push({
            category: 'hypertension',
            categoryLabelFa: 'پیش‌فشار خون (Prehypertension)',
            severity: 'moderate',
            detailsFa: `پیش‌فشار خون (${systolicBp}/${diastolicBp} mmHg - نیازمند اصلاح الگوی تغذیه و کاهش نمک)`,
            valueBadge: `BP: ${systolicBp}/${diastolicBp}`,
            subType: 'prehypertension'
          });
        }
      }

      // ── 3. High Blood Sugar Criteria (قند خون بالا: FBS, BS, HbA1c) ──
      if (bloodSugarStage !== 'normal') {
        const sugarDetails: string[] = [];
        if (fbs) sugarDetails.push(`قند ناشتا FBS: ${fbs} mg/dL`);
        if (randomBs) sugarDetails.push(`قند تصادفی BS: ${randomBs} mg/dL`);
        if (hba1c) sugarDetails.push(`HbA1c: ${hba1c}%`);

        if (bloodSugarStage === 'diabetes') {
          const isCritical = Boolean((fbs && fbs >= 200) || (randomBs && randomBs >= 250) || (hba1c && hba1c >= 8.5));
          matches.push({
            category: 'hyperglycemia',
            categoryLabelFa: 'دیابت و قند خون بالا',
            severity: isCritical ? 'critical' : 'high',
            detailsFa: `قند خون در محدوده دیابت (${sugarDetails.join(' · ')}) - نیازمند کنترل دقیق قند و رژیم دیابتی`,
            valueBadge: fbs ? `FBS: ${fbs}` : (hba1c ? `HbA1c: ${hba1c}%` : `BS: ${randomBs}`),
            subType: 'diabetes'
          });
        } else if (bloodSugarStage === 'prediabetes') {
          matches.push({
            category: 'hyperglycemia',
            categoryLabelFa: 'پیش‌دیابت و اختلال قند خون (Prediabetes)',
            severity: 'moderate',
            detailsFa: `قند خون در محدوده پیش‌دیابت (${sugarDetails.join(' · ')}) - مستعد ابتلا به دیابت نوع ۲`,
            valueBadge: fbs ? `FBS: ${fbs}` : (hba1c ? `HbA1c: ${hba1c}%` : `BS: ${randomBs}`),
            subType: 'prediabetes'
          });
        }
      }

      // ── 4. Fatty Liver Grade 2 & 3 (کبد چرب گرید ۲ و ۳) ──
      if (fattyLiverGrade === 'grade_2' || fattyLiverGrade === 'grade_3') {
        const isGrade3 = fattyLiverGrade === 'grade_3';
        matches.push({
          category: 'fatty_liver',
          categoryLabelFa: 'کبد چرب گرید ۲ و ۳',
          severity: isGrade3 ? 'critical' : 'high',
          detailsFa: isGrade3
            ? 'کبد چرب گرید ۳ (استئاتوز پیشرفته کبدی نیازمند برنامه پاکسازی و مداخله تغذیه‌ای فوری)'
            : 'کبد چرب گرید ۲ (استئاتوز متوسط، خطر پیشرفت هپاتیت متابولیک و آنزیم‌های بالا)',
          valueBadge: isGrade3 ? 'کبد چرب: گرید ۳' : 'کبد چرب: گرید ۲'
        });
      }

      // ── 5. Clinical Immediate / High-Risk Priority (سطح اولویت بالینی فوری/پرخطر) ──
      const hasClinicalPriority = 
        latestNutrition?.priority === 'urgent' ||
        latestNutrition?.priority === 'high_risk' ||
        latestExam?.status === 'needs_specialist' ||
        latestExam?.status === 'unfit' ||
        bloodPressureStage === 'crisis' ||
        (fbs && fbs >= 126) ||
        (triglycerides && triglycerides >= 500) ||
        (cholesterol && cholesterol >= 280) ||
        (systolicBp && systolicBp >= 140) ||
        (diastolicBp && diastolicBp >= 90);

      if (hasClinicalPriority && !matches.some(m => m.category === 'clinical_urgent')) {
        const reasons: string[] = [];
        let severity: 'critical' | 'high' | 'moderate' = 'high';

        if (latestNutrition?.priority === 'urgent' || latestExam?.status === 'unfit' || bloodPressureStage === 'crisis') {
          severity = 'critical';
          reasons.push('اولویت بالینی فوری / نامناسب برای شغل (Unfit)');
        }
        if (latestExam?.status === 'needs_specialist') {
          reasons.push('ارجاع تخصصی پزشک طب کار');
        }
        if (triglycerides && triglycerides >= 500) {
          reasons.push(`تری‌گلیسرید بحرانی (${triglycerides} mg/dL)`);
          severity = 'critical';
        }
        if (cholesterol && cholesterol >= 280) {
          reasons.push(`کلسترول بسیار بالا (${cholesterol} mg/dL)`);
        }
        if (fbs && fbs >= 126) {
          reasons.push(`دیابت / قند خون ناشتا (${fbs} mg/dL)`);
        }
        if (bloodPressureStage === 'stage_2' || bloodPressureStage === 'stage_1') {
          reasons.push(`پرفشاری خون (${systolicBp}/${diastolicBp} mmHg)`);
        }

        matches.push({
          category: 'clinical_urgent',
          categoryLabelFa: 'سطح اولویت بالینی فوری/پرخطر',
          severity,
          detailsFa: reasons.length > 0 ? reasons.join(' · ') : 'ثبت‌شده در اولویت بالینی فوری تغذیه و طب کار',
          valueBadge: severity === 'critical' ? 'اولویت: فوری و اورژانسی' : 'اولویت: پرخطر بالینی'
        });
      }

      // ── 6. Follow-up Due or Overdue (موعد پیگیری فرارسیده یا معوق) ──
      const hasDueFollowUp = isFollowUpOverdue || followUpStatus === 'missed' || (latestNutrition && followUpStatus === 'pending' && !nextFollowUpDate);
      if (hasDueFollowUp) {
        const isCriticalOverdue = Boolean(nextFollowUpInt > 0 && todayInt - nextFollowUpInt > 14); // Overdue more than 14 days
        matches.push({
          category: 'followup_due',
          categoryLabelFa: 'موعد پیگیری فرارسیده یا معوق',
          severity: isCriticalOverdue ? 'critical' : 'high',
          detailsFa: isFollowUpOverdue
            ? `موعد نوبت پیگیری تغذیه در تاریخ ${nextFollowUpDate} فرارسیده یا سپری شده است.`
            : followUpStatus === 'missed'
            ? 'جلسه پیگیری تغذیه معوق مانده است.'
            : 'در انتظار تشکیل جلسه پیگیری و مشاوره دوره‌ای تغذیه',
          valueBadge: isFollowUpOverdue ? `پیگیری: ${nextFollowUpDate} (موعد رسیده)` : 'پیگیری: نیازمند اقدام'
        });
      }

      // ── 7. Indeterminate or Unspecified Unit Results (نتایج فاقد اطلاعات معتبر یا دارای واحد نامشخص) ──
      if (hasIndeterminateLabResults) {
        matches.push({
          category: 'needs_review',
          categoryLabelFa: 'نتایج نامشخص یا نیازمند بررسی',
          severity: 'moderate',
          detailsFa: indeterminateLabDetails || 'نتایج آزمایشگاهی فاقد اطلاعات معتبر یا دارای واحد نامشخص بوده و نیازمند بررسی است.',
          valueBadge: 'نیازمند بررسی',
          subType: 'indeterminate_lab'
        });
      }

      // If at least ONE of the high-risk criteria is matched, include this personnel
      if (matches.length > 0) {
        // Determine primary risk category (most severe)
        let primaryCategory: HighRiskCategoryType = matches[0].category;
        if (matches.some(m => m.severity === 'critical')) {
          const crit = matches.find(m => m.severity === 'critical');
          if (crit) primaryCategory = crit.category;
        } else if (matches.some(m => m.category === 'fatty_liver')) {
          primaryCategory = 'fatty_liver';
        } else if (matches.some(m => m.category === 'hyperglycemia')) {
          primaryCategory = 'hyperglycemia';
        } else if (matches.some(m => m.category === 'hypertension')) {
          primaryCategory = 'hypertension';
        } else if (matches.some(m => m.category === 'bmi_obese' || m.category.startsWith('bmi_obese_'))) {
          primaryCategory = matches.find(m => m.category.startsWith('bmi_obese_'))?.category || 'bmi_obese';
        } else if (matches.some(m => m.category === 'needs_review')) {
          primaryCategory = 'needs_review';
        }

        const overallPriority: 'urgent' | 'high_risk' | 'routine' = 
          matches.some(m => m.severity === 'critical') ? 'urgent' : 'high_risk';

        highRiskProfiles.push({
          id: `hr-${personnelCode}`,
          personnelCode,
          nationalCode,
          fullName,
          unit,
          department,
          jobTitle,
          phone,
          gender,
          age,
          riskCategories: matches,
          primaryRiskCategory: primaryCategory,
          overallPriority,
          height: height || undefined,
          weight: weight || undefined,
          bmi,
          bmiCategory,
          waistCircumference: latestNutrition?.waistCircumference,
          whr: latestNutrition?.whr,
          fattyLiverGrade,
          fattyLiverDetails,
          systolicBp,
          diastolicBp,
          bpMeasurementDate,
          bloodPressureStage,
          fbs,
          randomBs,
          hba1c,
          bloodSugarTestType,
          bloodSugarValue,
          bloodSugarUnit,
          bloodSugarMeasurementDate,
          bloodSugarStage,
          cholesterol,
          triglycerides,
          underlyingConditions,
          hasIndeterminateLabResults,
          indeterminateLabDetails,
          lastExamDate: latestExam?.examDate || undefined,
          lastExamYear: latestExam?.examYear || undefined,
          bmiMeasurementDate,
          examFitnessStatus: latestExam?.status || undefined,
          examDoctorVerdict: latestExam?.findings?.generalConclusion || undefined,
          examRecommendations: latestExam?.recommendations || undefined,
          hasPeriodicExamRecord: Boolean(latestExam),
          allExamsHistory: pExams, // Complete historical timeline of periodic exams
          nutritionRecordId: latestNutrition?.id || undefined,
          hasNutritionRecord: Boolean(latestNutrition),
          dietGoal: latestNutrition?.dietGoal || undefined,
          dailyCalorieTarget: latestNutrition?.dailyCalorieTarget || undefined,
          dietPlanSummary: latestNutrition?.dietPlanSummary || undefined,
          recommendations: latestNutrition?.recommendations || [],
          supplements: latestNutrition?.supplements || undefined,
          consultationType: latestNutrition?.consultationType || undefined,
          consultantName: latestNutrition?.consultantName || undefined,
          consultationNotes: latestNutrition?.consultationNotes || undefined,
          lastFollowUpDate: latestNutrition?.visitDate || undefined,
          lastFollowUpNotes: latestNutrition?.consultationNotes || undefined,
          followUpStatus,
          nextFollowUpDate,
          isFollowUpOverdue,
          updatedAt: latestNutrition?.updatedAt || latestExam?.updatedAt || new Date().toISOString()
        });
      }
    });

    // Sort: Urgent first, then Overdue, then critical BMI/BP, then recent
    highRiskProfiles.sort((a, b) => {
      const urgencyScore = (p: HighRiskPersonnelProfile) => {
        let score = 0;
        if (p.overallPriority === 'urgent') score += 1000;
        if (p.isFollowUpOverdue) score += 500;
        if (p.bloodPressureStage === 'crisis') score += 450;
        if (p.fattyLiverGrade === 'grade_3') score += 400;
        if (p.bmi >= 40) score += 350;
        if (p.bloodSugarStage === 'diabetes') score += 300;
        if (p.bloodPressureStage === 'stage_2') score += 250;
        if (p.fattyLiverGrade === 'grade_2') score += 200;
        if (p.bmi >= 35) score += 150;
        if (p.bloodPressureStage === 'stage_1') score += 100;
        return score;
      };
      return urgencyScore(b) - urgencyScore(a);
    });

    return highRiskProfiles;
  }

  /**
   * Filter high risk profiles by selected category, search term, unit, and status
   */
  public filterProfiles(
    profiles: HighRiskPersonnelProfile[],
    category: HighRiskCategoryType,
    searchQuery: string,
    unitFilter: string,
    followUpFilter: string,
    severityFilter: string = 'all'
  ): HighRiskPersonnelProfile[] {
    return profiles.filter(profile => {
      // 1. Category Filter
      if (category !== 'all') {
        const hasCategory = profile.riskCategories.some(c => {
          if (c.category === category) return true;
          // If filtering by general bmi_obese, match any of the obese grades
          if (category === 'bmi_obese' && (c.category === 'bmi_obese_1' || c.category === 'bmi_obese_2' || c.category === 'bmi_obese_3')) {
            return true;
          }
          return false;
        });
        if (!hasCategory) return false;
      }

      // 2. Unit Filter
      if (unitFilter && unitFilter !== 'all' && profile.unit !== unitFilter) {
        return false;
      }

      // 3. Severity Filter
      if (severityFilter && severityFilter !== 'all') {
        if (severityFilter === 'urgent' && profile.overallPriority !== 'urgent') return false;
        if (severityFilter === 'high_risk' && profile.overallPriority !== 'high_risk') return false;
      }

      // 4. Follow-up status filter
      if (followUpFilter && followUpFilter !== 'all') {
        if (followUpFilter === 'overdue' && !profile.isFollowUpOverdue && profile.followUpStatus !== 'missed') return false;
        if (followUpFilter === 'no_dossier' && profile.hasNutritionRecord) return false;
        if (followUpFilter === 'needs_review') {
          if (!profile.hasIndeterminateLabResults && profile.followUpStatus !== 'pending') return false;
        } else if (followUpFilter !== 'overdue' && followUpFilter !== 'no_dossier' && profile.followUpStatus !== followUpFilter) {
          return false;
        }
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (profile.fullName || '').toLowerCase().includes(q);
        const matchCode = (profile.personnelCode || '').toLowerCase().includes(q);
        const matchNat = (profile.nationalCode || '').toLowerCase().includes(q);
        const matchJob = (profile.jobTitle || '').toLowerCase().includes(q);
        const matchUnit = (profile.unit || '').toLowerCase().includes(q);
        const matchRisk = profile.riskCategories.some(r => r.detailsFa.toLowerCase().includes(q) || r.categoryLabelFa.toLowerCase().includes(q));

        if (!matchName && !matchCode && !matchNat && !matchJob && !matchUnit && !matchRisk) {
          return false;
        }
      }

      return true;
    });
  }
}

export const highRiskNutritionService = new HighRiskNutritionService();
