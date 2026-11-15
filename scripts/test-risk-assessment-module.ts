import assert from 'node:assert/strict';
import {
  computeFtaTreeProbabilities,
  validateAssessmentWorkflow,
  findSimilarHazardSuggestions,
  isActionOverdue,
} from '../src/modules/risk-assessment/services/riskWorkflowEngine';
import {
  DEFAULT_RISK_MATRIX_CONFIG,
  evaluateMatrixScore,
  extractMatrixPointsFromAssessments,
} from '../src/modules/risk-assessment/services/riskMatrixConfig';
import {
  calculateRiskLevel,
  ORDERED_RISK_METHODS,
} from '../src/modules/risk-assessment/services/riskAssessmentService';
import {
  FtaEventNode,
  RiskMatrixConfig,
  WhatIfAssessment,
  BowTieAssessment,
  JobActivityAssessment,
  HhaAssessment,
} from '../src/modules/risk-assessment/types';
import {
  createRiskAssessment,
  getRiskAssessmentById,
  updateRiskAssessment,
  deleteRiskAssessment,
} from '../server/db-services';

async function runTests() {
  console.log('=== Risk Assessment Module Verification ===');

  // 1. Verify 8 ordered methods (with FTA preserved, zero FTE)
  assert.deepEqual(ORDERED_RISK_METHODS, [
    'FMEA',
    'JSA',
    'FTA',
    'HHA',
    'WHAT_IF',
    'BOWTIE',
    'MATRIX',
    'JOB_ACTIVITY',
  ]);
  console.log('[PASS] 8 ordered risk methodologies verified (FTA preserved)');

  // 2. FTA Probability Engine (AND, OR, VOTING 2-of-3, INHIBIT)
  const ftaNodes: FtaEventNode[] = [
    { id: 'top', type: 'TOP_EVENT', gateType: 'OR', description: 'آتش‌سوزی مخزن' },
    { id: 'g1', parentId: 'top', type: 'INTERMEDIATE_EVENT', gateType: 'AND', description: 'نشت + جرقه' },
    { id: 'b1', parentId: 'g1', type: 'BASIC_EVENT', probability: 0.1, description: 'نشت فلنج' },
    { id: 'b2', parentId: 'g1', type: 'BASIC_EVENT', probability: 0.2, description: 'منبع جرقه' },
    { id: 'g2', parentId: 'top', type: 'INTERMEDIATE_EVENT', gateType: 'VOTING', votingThreshold: 2, description: 'خرابی ۲ از ۳ سنسور' },
    { id: 's1', parentId: 'g2', type: 'BASIC_EVENT', probability: 0.1, description: 'سنسور ۱' },
    { id: 's2', parentId: 'g2', type: 'BASIC_EVENT', probability: 0.1, description: 'سنسور ۲' },
    { id: 's3', parentId: 'g2', type: 'BASIC_EVENT', probability: 0.1, description: 'سنسور ۳' },
  ];
  const ftaResult = computeFtaTreeProbabilities(ftaNodes);
  // g1 = 0.1 * 0.2 = 0.02
  assert.ok(Math.abs(ftaResult.nodeProbabilities['g1'] - 0.02) < 1e-6);
  // g2 = 3*(0.1^2)*(0.9) + 0.1^3 = 0.027 + 0.001 = 0.028
  assert.ok(Math.abs(ftaResult.nodeProbabilities['g2'] - 0.028) < 1e-6);
  // top = 1 - (1 - 0.02)*(1 - 0.028) = 1 - 0.98*0.972 = 1 - 0.95256 = 0.04744
  assert.ok(Math.abs(ftaResult.topEventProbability - 0.04744) < 1e-5);
  console.log('[PASS] FTA probability math (OR / AND / 2-of-3 VOTING)');

  // 3. Configurable Risk Matrix & RPN thresholds
  assert.equal(evaluateMatrixScore(3, DEFAULT_RISK_MATRIX_CONFIG).level, 'LOW');
  assert.equal(evaluateMatrixScore(8, DEFAULT_RISK_MATRIX_CONFIG).level, 'MEDIUM');
  assert.equal(evaluateMatrixScore(12, DEFAULT_RISK_MATRIX_CONFIG).level, 'HIGH');
  assert.equal(evaluateMatrixScore(20, DEFAULT_RISK_MATRIX_CONFIG).level, 'CRITICAL');

  const strictConfig: RiskMatrixConfig = {
    ...DEFAULT_RISK_MATRIX_CONFIG,
    thresholds: DEFAULT_RISK_MATRIX_CONFIG.thresholds.map(t =>
      t.level === 'HIGH'
        ? { ...t, minScore: 8, maxScore: 11 }
        : t.level === 'CRITICAL'
        ? { ...t, minScore: 12, maxScore: 25 }
        : t.level === 'MEDIUM'
        ? { ...t, minScore: 4, maxScore: 7 }
        : { ...t, minScore: 1, maxScore: 3 }
    ),
  };
  assert.equal(calculateRiskLevel(12, '5x5', strictConfig), 'CRITICAL');
  assert.equal(calculateRiskLevel(210, 'RPN'), 'CRITICAL');
  assert.equal(calculateRiskLevel(125, 'RPN'), 'HIGH');
  console.log('[PASS] Configurable risk matrix & RPN thresholds');

  // 4. Workflow Validation (orphan action & archive evidence checks)
  const orphanIssues = validateAssessmentWorkflow(
    {
      method: 'WHAT_IF',
      title: 'بررسی سناریوی خط انتقال گاز',
      unit: 'بهره‌برداری',
      assessorName: 'علی رضایی',
      assessmentDate: '1404/02/15',
      questions: [
        {
          id: 'q1',
          question: 'اگر شیر ایمنی عمل نکند چه می‌شود؟',
          expertAnswer: 'افزایش فشار بیش از حد',
          hazards: 'انفجار خط لوله',
          consequences: 'آسیب جدی',
          existingControls: 'گیج فشار',
          initialProbability: 3,
          initialSeverity: 5,
          initialRiskScore: 15,
          initialRiskLevel: 'CRITICAL',
          recommendations: 'نصب PSV مضاعف',
          responsible: '',
          deadline: '',
          status: 'OPEN',
          residualProbability: 1,
          residualSeverity: 5,
          residualRiskScore: 5,
          residualRiskLevel: 'MEDIUM',
        },
      ],
      controlActions: [
        {
          id: 'act1',
          title: 'تست شیر اطمینان',
          hierarchyControl: 'ENGINEERING',
          owner: '',
          deadline: '',
          status: 'OPEN',
        },
      ],
    } as Partial<WhatIfAssessment>,
    'SUBMIT_REVIEW'
  );
  assert.ok(orphanIssues.some(i => i.field.includes('controlActions')));

  const draftIssues = validateAssessmentWorkflow(
    { method: 'WHAT_IF', title: 'پیش‌نویس اولیه' },
    'DRAFT'
  );
  assert.equal(draftIssues.length, 0);
  console.log('[PASS] 10-stage workflow validation rules');

  // 5. Matrix Points Extraction across What-If, BowTie, JobActivity, HHA
  const sampleHha: HhaAssessment = {
    id: 'test-hha-1',
    code: 'HHA-TEST-01',
    title: 'ارزیابی صدا و خطای انسانی اتاق کنترل',
    site: 'پالایشگاه اول',
    unit: 'بهره‌برداری',
    areaLocation: 'اتاق کنترل مرکزی',
    assessorName: 'مریم کریمی',
    assessmentDate: '1404/02/10',
    status: 'APPROVED',
    method: 'HHA',
    overallRiskLevel: 'HIGH',
    initialRiskScore: 12,
    residualRiskScore: 4,
    residualRiskLevel: 'LOW',
    assessedDepartment: 'بهره‌برداری',
    headcountExposed: 12,
    items: [
      {
        id: 'h1',
        jobRole: 'اپراتور اتاق کنترل',
        workplaceArea: 'کنسول A',
        analysisDomain: 'HUMAN_FACTORS',
        hazardCategory: 'HUMAN_ERROR',
        agentName: 'خستگی شیفت شب و خطای تشخیص آلارم',
        exposureRoute: 'COGNITIVE_TASK',
        exposureDuration: '8 ساعت',
        healthEffect: 'تاخیر در واکنش اضطراری',
        riskRating: 'HIGH',
        existingControls: 'چک‌لیست تحویل شیفت',
        proposedControls: 'کاهش آلارم‌های کاذب و بازنگری شیفت',
        targetMedicalTests: 'پایش خواب و استرس',
        errorType: 'INATTENTION',
        performanceShapingFactors: 'تراکم آلارم در شیفت شب',
        organizationalConditions: 'کمبود نیروی جایگزین',
        preventiveBarriers: 'اولویت‌بندی آلارم‌ها',
        trainingActions: 'آموزش شبیه‌ساز بحران',
        initialProbability: 3,
        initialSeverity: 4,
        initialRiskScore: 12,
        residualProbability: 1,
        residualSeverity: 4,
        residualRiskScore: 4,
        residualRiskLevel: 'LOW',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleJobActivity: JobActivityAssessment = {
    id: 'test-ja-1',
    code: 'JOB-TEST-01',
    title: 'ارزیابی ریسک شغل جوشکار تعمیرات',
    site: 'پالایشگاه اول',
    unit: 'تعمیرات مکانیک',
    areaLocation: 'کارگاه مرکزی',
    assessorName: 'حسین محمدی',
    assessmentDate: '1404/02/12',
    status: 'APPROVED',
    method: 'JOB_ACTIVITY',
    overallRiskLevel: 'CRITICAL',
    initialRiskScore: 16,
    residualRiskScore: 6,
    residualRiskLevel: 'MEDIUM',
    jobPosition: 'جوشکار برق و آرگون',
    exposedPersonnel: ['علی احمدی'],
    reviewCycleMonths: 12,
    nextReviewDate: '1405/02/12',
    hazardsList: [
      {
        id: 'jh1',
        hazardCategory: 'HEALTH',
        hazardTitle: 'استنشاق فیوم جوشکاری',
        exposureCondition: 'روتین',
        consequence: 'بیماری تنفسی',
        existingControls: 'تهویه عمومی',
        initialProbability: 4,
        initialSeverity: 4,
        initialScore: 16,
        initialLevel: 'CRITICAL',
        hierarchyControl: 'ENGINEERING',
        controlMeasures: 'نصب هود مکنده موضعی',
        actionOwner: 'سرپرست تعمیرات',
        actionDeadline: '1404/04/01',
        actionStatus: 'IN_PROGRESS',
        residualProbability: 2,
        residualSeverity: 3,
        residualScore: 6,
        residualLevel: 'MEDIUM',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleBowTie: BowTieAssessment = {
    id: 'test-bt-1',
    code: 'BT-TEST-01',
    title: 'پاپیونی نشت گاز H2S',
    site: 'پالایشگاه اول',
    unit: 'فرایند',
    areaLocation: 'واحد شیرین‌سازی',
    assessorName: 'رضا حسینی',
    assessmentDate: '1404/02/14',
    status: 'UNDER_REVIEW',
    method: 'BOWTIE',
    overallRiskLevel: 'CRITICAL',
    bowtie: {
      hazard: 'گاز سمی H2S تحت فشار',
      topEvent: 'از دست رفتن مهار و نشت گاز H2S',
      threats: [
        {
          id: 't1',
          title: 'خوردگی داخلی لوله',
          likelihood: 4,
          barriers: [
            {
              id: 'b1',
              title: 'پایش ضخامت‌سنجی دوره‌ای',
              barrierType: 'ENGINEERING',
              owner: 'بازرسی فنی',
              effectiveness: 'HIGH',
              status: 'ACTIVE',
              escalationFactors: [
                { id: 'ef1', title: 'تاخیر در بازرسی دوره‌ای', controlMeasure: 'هشدار سیستم CMMS' },
              ],
            },
          ],
        },
      ],
      consequences: [
        {
          id: 'c1',
          title: 'مسمومیت حاد پرسنل',
          severity: 5,
          category: 'SAFETY',
          barriers: [
            {
              id: 'mb1',
              title: 'سیستم دتکتور ثابت و آژیر تخلیه',
              barrierType: 'DETECTIVE',
              owner: 'ابزار دقیق',
              effectiveness: 'HIGH',
              status: 'ACTIVE',
              escalationFactors: [],
            },
          ],
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialPts = extractMatrixPointsFromAssessments(
    [sampleHha, sampleJobActivity, sampleBowTie],
    DEFAULT_RISK_MATRIX_CONFIG,
    'INITIAL'
  );
  const residualPts = extractMatrixPointsFromAssessments(
    [sampleHha, sampleJobActivity, sampleBowTie],
    DEFAULT_RISK_MATRIX_CONFIG,
    'RESIDUAL'
  );
  assert.equal(initialPts.length, 3);
  assert.equal(residualPts.length, 3);
  assert.equal(initialPts[0].score, 12);
  assert.equal(residualPts[0].score, 4);
  console.log('[PASS] Matrix initial & residual point extraction');

  // 6. Advisory Hazard Suggestion Engine + Overdue Check
  const suggestions = findSimilarHazardSuggestions(
    { title: 'جوشکار تعمیرات', unit: 'تعمیرات' },
    [sampleHha, sampleJobActivity, sampleBowTie],
    [{ id: 1, incidentNumber: 'INC-101', description: 'سوختگی حین جوشکاری', immediateCauses: 'نقص شیلد جوشکاری' }],
    []
  );
  assert.ok(suggestions.length >= 1);
  assert.equal(isActionOverdue('1399/01/01', 'OPEN'), true);
  assert.equal(isActionOverdue('1399/01/01', 'DONE'), false);
  console.log('[PASS] Cross-module advisory suggestion & overdue check');

  // 7. Database Round-Trip Verification (Create -> Read -> Update -> Delete)
  try {
    const created = await createRiskAssessment({
      ...sampleBowTie,
      id: undefined as any,
      code: `RA-VERIFY-${Date.now()}`,
      controlActions: [
        {
          id: 'act-db-1',
          title: 'بازرسی ضخامت‌سنجی خط',
          hierarchyControl: 'ENGINEERING',
          owner: 'بازرسی فنی',
          deadline: '1404/05/01',
          status: 'OPEN',
        },
      ],
      reviewHistory: [
        {
          id: 'rev-1',
          timestamp: new Date().toISOString(),
          actor: 'TestRunner',
          toStatus: 'UNDER_REVIEW',
          notes: 'Automated verification',
        },
      ],
    });
    assert.ok(created && created.dbId, 'Created assessment must return numeric dbId');
    assert.equal(created.method, 'BOWTIE');
    assert.equal(created.bowtie?.hazard, 'گاز سمی H2S تحت فشار');
    assert.equal(created.controlActions?.length, 1);

    const fetched = await getRiskAssessmentById(created.dbId);
    assert.ok(fetched);
    assert.equal(fetched.code, created.code);

    const updated = await updateRiskAssessment(created.dbId, {
      status: 'APPROVED',
      approverName: 'مدیر HSE',
      workflowStage: 'EFFECTIVENESS_ARCHIVE',
    });
    assert.equal(updated.status, 'APPROVED');
    assert.equal(updated.approverName, 'مدیر HSE');

    const deleted = await deleteRiskAssessment(created.dbId);
    assert.ok(Array.isArray(deleted) && deleted.length === 1);
    const afterDelete = await getRiskAssessmentById(created.dbId);
    assert.equal(afterDelete, null);
    console.log('[PASS] Database full CRUD round-trip (BOWTIE + controlActions + reviewHistory)');
  } catch (dbErr: any) {
    console.warn('[WARN] Database round-trip skipped or failed:', dbErr?.message || dbErr);
    throw dbErr;
  }

  console.log('=== ALL RISK ASSESSMENT TESTS PASSED ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
