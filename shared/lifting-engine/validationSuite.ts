import {
  evaluateCraneLoadChart,
  evaluateFullLiftingPlan,
  evaluateLiftingAndTurning,
  evaluateRiggingAndLoadCases,
  evaluateTandemLift,
  fromKpa,
  fromMeters,
  fromMetersPerSec,
  fromMetricTon,
  LIFTING_ENGINE_VERSION,
  LoadChartPoint,
  roundDisplay,
  toKpa,
  toMeters,
  toMetersPerSec,
  toMetricTon,
} from './index.ts';

export interface BenchmarkTestCaseResult {
  testId: string;
  scenarioGroup: string;
  titleFa: string;
  method: string;
  inputSummary: string;
  expectedValue: string | number;
  actualValue: string | number;
  unit: string;
  absDiff: number | null;
  relDiffPct: number | null;
  tolerancePct: number | null;
  passed: boolean;
  standardRef: string;
  notes?: string;
}

export interface BenchmarkSuiteReport {
  engineVersion: string;
  executedAt: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  allPassed: boolean;
  cases: BenchmarkTestCaseResult[];
}

const BENCHMARK_CRANE_CHART: LoadChartPoint[] = [
  { outriggerConfig: '100_OUTRIGGERS', counterweightTon: 20, boomLengthM: 20, radiusM: 8, ratedCapacityTon: 45 },
  { outriggerConfig: '100_OUTRIGGERS', counterweightTon: 20, boomLengthM: 20, radiusM: 12, ratedCapacityTon: 30 },
  { outriggerConfig: '100_OUTRIGGERS', counterweightTon: 20, boomLengthM: 20, radiusM: 16, ratedCapacityTon: 20 },
  { outriggerConfig: '100_OUTRIGGERS', counterweightTon: 20, boomLengthM: 30, radiusM: 10, ratedCapacityTon: 36 },
  { outriggerConfig: '100_OUTRIGGERS', counterweightTon: 20, boomLengthM: 30, radiusM: 14, ratedCapacityTon: 24 },
  { outriggerConfig: '100_OUTRIGGERS', counterweightTon: 20, boomLengthM: 30, radiusM: 20, ratedCapacityTon: 14 },
];

export function runIndependentBenchmarkSuite(): BenchmarkSuiteReport {
  const cases: BenchmarkTestCaseResult[] = [];

  // TC-01: Normal Lift / Symmetric 2-Leg 45 deg exact equilibrium + Crane Utilization
  {
    const res = evaluateFullLiftingPlan({
      liftCategory: 'STANDARD',
      crane: {
        boomLengthM: 20,
        radiusM: 12,
        outriggerConfig: '100_OUTRIGGERS',
        craneDeadWeightTon: 38,
        outriggerPadAreaM2: 1.44,
        chartPoints: BENCHMARK_CRANE_CHART,
      },
      rigging: {
        netLoadWeightTon: 10,
        riggingAccessoryWeightTon: 0.4,
        hookBlockWeightTon: 0.6,
        dynamicFactor: 1.0,
        cogOffset: { x: 0, y: 0, z: 0 },
        hookPosition: { x: 0, y: 2, z: 0 },
        attachmentPoints: [
          { id: 'L1', label: 'Left', position: { x: -2, y: 0, z: 0 } },
          { id: 'L2', label: 'Right', position: { x: 2, y: 0, z: 0 } },
        ],
        slingWllTon: 12,
        shackleWllTon: 12,
      },
      windSpeedMs: 7.5,
      groundBearingMaxKpa: 300,
    });
    const expectedTension = 5 / Math.SQRT1_2; // 7.0710678...
    const actualTension = res.riggingResult.governingLegTensionTon;
    const absDiff = Math.abs(actualTension - expectedTension);
    const relDiffPct = (absDiff / expectedTension) * 100;
    cases.push({
      testId: 'TC-01',
      scenarioGroup: '1. باربرداری عادی متقارن (Normal Lift)',
      titleFa: 'تعادل متقارن ۲ شاخه ۴۵ درجه و کنترل بهره‌برداری جرثقیل',
      method: 'Exact Hand Static Equilibrium T = (W/2)/sin(45°)',
      inputSummary: 'W_net=10t, Rig=0.4t, Hook=0.6t, DAF=1.0, θ=45°, Boom=20m, R=12m (Chart=30t)',
      expectedValue: roundDisplay(expectedTension, 3),
      actualValue: actualTension,
      unit: 'ton',
      absDiff: roundDisplay(absDiff, 5),
      relDiffPct: roundDisplay(relDiffPct, 4),
      tolerancePct: 0.1,
      passed: relDiffPct <= 0.1 && res.overallStatus === 'PASS' && Math.abs((res.remainingCraneCapacityTon || 0) - 19) < 0.05,
      standardRef: 'ASME B30.9 Sec. 9-2.9 / ASME B30.5 Sec. 5-1.1',
    });
  }

  // TC-02: Asymmetric 2-leg lift (Lever arm equilibrium, NO clamping!)
  {
    const res = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 12,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 1, y: 0, z: 0 }, // 3m from L1 (-2) and 1m from L2 (+2) -> F2 = 9t, F1 = 3t
      hookPosition: { x: 1, y: 3, z: 0 },
      attachmentPoints: [
        { id: 'L1', label: 'Left', position: { x: -2, y: 0, z: 0 } },
        { id: 'L2', label: 'Right', position: { x: 2, y: 0, z: 0 } },
      ],
      slingWllTon: 15,
      shackleWllTon: 15,
    });
    // L2 vertical share = 9t; dx = 1 - 2 = -1, dy = 3 => L = sqrt(10), sin = 3/sqrt(10) => T2 = 9 * sqrt(10) / 3 = 3 * sqrt(10) = 9.486833t
    const expectedT2 = 3 * Math.sqrt(10);
    const actualT2 = res.governingLegTensionTon;
    const absDiff = Math.abs(actualT2 - expectedT2);
    const relDiffPct = (absDiff / expectedT2) * 100;
    cases.push({
      testId: 'TC-02',
      scenarioGroup: '2. بارگذاری نامتقارن (Asymmetric Rigging)',
      titleFa: 'توزیع نامتقارن بار با اهرم CoG و طول نامساوی شاخه‌ها',
      method: 'Exact Moment Balance R2 = W*(d1/L) & 3D Vector Projection',
      inputSummary: 'W=12t, Points x=-2m/+2m, CoG x=+1.0m, Hook=(1,3,0)',
      expectedValue: roundDisplay(expectedT2, 3),
      actualValue: actualT2,
      unit: 'ton',
      absDiff: roundDisplay(absDiff, 5),
      relDiffPct: roundDisplay(relDiffPct, 4),
      tolerancePct: 0.1,
      passed: relDiffPct <= 0.1 && Math.abs(res.legs[1].verticalShareTon - 9) < 0.01 && Math.abs(res.legs[0].verticalShareTon - 3) < 0.01,
      standardRef: 'ASME P30.1 Sec. 2-2.2',
    });
  }

  // TC-03: CoG Shift + Sensitivity LC3 across ALL 4 dropped-leg subsets
  {
    const res = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 20,
      riggingAccessoryWeightTon: 0.5,
      hookBlockWeightTon: 0.5,
      dynamicFactor: 1.1,
      cogOffset: { x: 0.3, y: 0, z: 0.2 },
      hookPosition: { x: 0.3, y: 3.5, z: 0.2 },
      attachmentPoints: [
        { id: 'P1', label: 'P1', position: { x: 2, y: 0, z: 1 } },
        { id: 'P2', label: 'P2', position: { x: -2, y: 0, z: 1 } },
        { id: 'P3', label: 'P3', position: { x: -2, y: 0, z: -1 } },
        { id: 'P4', label: 'P4', position: { x: 2, y: 0, z: -1 } },
      ],
      slingWllTon: 25,
      shackleWllTon: 25,
      enforceThreeLegEffectiveForFourLeg: true,
    });
    const lc2 = res.loadCases.find((l) => l.caseId === 'LC2_DESIGN');
    const lc3 = res.loadCases.find((l) => l.caseId === 'LC3_COG_SHIFT');
    // LC3 shifts CoG further (+0.2m X, +0.2m Z) so max leg tension in LC3 MUST exceed LC2
    const passed = Boolean(lc2 && lc3 && lc3.maxLegTensionTon > lc2.maxLegTensionTon && res.overturningMomentTonM > 0);
    cases.push({
      testId: 'TC-03',
      scenarioGroup: '3. جابه‌جایی مرکز ثقل (CoG Shift)',
      titleFa: 'تحلیل حساسیت جابه‌جایی CoG و بررسی هر ۴ زیرمجموعه ۳ شاخه',
      method: 'Worst-Case 4-Subset Search across CoG Shift +0.20m X/Z',
      inputSummary: 'W_net=20t, CoG=(0.3,0,0.2) -> Shift(0.5,0,0.4)',
      expectedValue: `LC3 > LC2 (${lc2?.maxLegTensionTon}t)`,
      actualValue: lc3?.maxLegTensionTon ?? 0,
      unit: 'ton',
      absDiff: lc2 && lc3 ? roundDisplay(lc3.maxLegTensionTon - lc2.maxLegTensionTon, 3) : null,
      relDiffPct: 0,
      tolerancePct: 0.5,
      passed,
      standardRef: 'ASME B30.9 Sec. 9-2.9 / P30.1',
    });
  }

  // TC-04: Critical Sling Angle Boundary (<30 deg FAIL)
  {
    const resShallow = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 10,
      riggingAccessoryWeightTon: 0.4,
      hookBlockWeightTon: 0.6,
      dynamicFactor: 1.1,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 0.9, z: 0 },
      attachmentPoints: [
        { id: 'L1', label: 'Left', position: { x: -2, y: 0, z: 0 } },
        { id: 'L2', label: 'Right', position: { x: 2, y: 0, z: 0 } },
      ],
      slingWllTon: 25,
      shackleWllTon: 25,
    });
    // exact asin(0.9 / sqrt(2^2 + 0.9^2)) = 24.2277 deg
    const expectedAngle = (Math.asin(0.9 / Math.hypot(2, 0.9)) * 180) / Math.PI;
    const absDiff = Math.abs(resShallow.minHorizontalAngleDeg - expectedAngle);
    cases.push({
      testId: 'TC-04',
      scenarioGroup: '4. زاویه اسلینگ بحرانی (Critical Angle)',
      titleFa: 'رد قطعی زاویه افقی کمتر از ۳۰ درجه (< 30° MUST FAIL)',
      method: 'Trigonometric arcsin(ΔY / L_sling)',
      inputSummary: 'HookY=0.9m, HalfSpan=2.0m => θ=24.23°',
      expectedValue: roundDisplay(expectedAngle, 2),
      actualValue: resShallow.minHorizontalAngleDeg,
      unit: 'deg',
      absDiff: roundDisplay(absDiff, 4),
      relDiffPct: roundDisplay((absDiff / expectedAngle) * 100, 3),
      tolerancePct: 0.1,
      passed: absDiff < 0.05 && resShallow.status === 'FAIL',
      standardRef: 'ASME B30.9 Sec. 9-1.7',
    });
  }

  // TC-05: Multi-Point 4-Leg Rigid Lift -> 3-Leg Effective Verification
  {
    const res4 = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 18,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 3, z: 0 },
      attachmentPoints: [
        { id: 'P1', label: 'P1', position: { x: 1.5, y: 0, z: 1 } },
        { id: 'P2', label: 'P2', position: { x: -1.5, y: 0, z: 1 } },
        { id: 'P3', label: 'P3', position: { x: -1.5, y: 0, z: -1 } },
        { id: 'P4', label: 'P4', position: { x: 1.5, y: 0, z: -1 } },
      ],
      slingWllTon: 20,
      shackleWllTon: 20,
      enforceThreeLegEffectiveForFourLeg: true,
    });
    // With 1 dropped leg on centered rectangle, worst-case active leg takes 50% vertical share (9t) instead of 25% (4.5t)!
    // dx=1.5, dy=3, dz=1 => L = sqrt(2.25 + 9 + 1) = sqrt(12.25) = 3.5m => sin=3/3.5 => factor=3.5/3=1.16667 => T = 9 * 3.5 / 3 = 10.5t
    const expectedMaxT = 10.5;
    const absDiff = Math.abs(res4.governingLegTensionTon - expectedMaxT);
    cases.push({
      testId: 'TC-05',
      scenarioGroup: '5. باربرداری چندنقطه‌ای (Multi-Point)',
      titleFa: 'قانون ۳ شاخه مؤثر روی بار صلب ۴ نقطه‌ای',
      method: 'Exhaustive 4-Choose-3 Subset Rigid Equilibrium',
      inputSummary: 'W=18t, Rectangle 3m×2m, HookY=3m (L=3.5m)',
      expectedValue: expectedMaxT,
      actualValue: res4.governingLegTensionTon,
      unit: 'ton',
      absDiff: roundDisplay(absDiff, 4),
      relDiffPct: roundDisplay((absDiff / expectedMaxT) * 100, 3),
      tolerancePct: 0.2,
      passed: absDiff < 0.02 && res4.effectiveLegCount === 3,
      standardRef: 'ASME B30.9 Sec. 9-2.9 / P30.1',
    });
  }

  // TC-06: Tandem Multi-Crane + 75% Derating Rule
  {
    const tandem = evaluateTandemLift({
      enabled: true,
      grossLoadTon: 30,
      dynamicFactor: 1.1,
      crane1DistanceFromCogM: 4,
      crane2DistanceFromCogM: 6,
      cogUncertaintyM: 0.5,
      outOfLevelDeg: 1.5,
      crane1RatedCapacityTon: 35,
      crane2RatedCapacityTon: 28,
    });
    // W_des = 33t; nom1 = 33 * (6/10) = 19.8t; nom2 = 33 * (4/10) = 13.2t
    const absDiff = Math.abs(tandem.crane1NominalLoadTon - 19.8);
    cases.push({
      testId: 'TC-06',
      scenarioGroup: '6. باربرداری همزمان دو جرثقیل (Multi-Crane / Tandem)',
      titleFa: 'تقسیم بار اهرمی + عدم قطعیت CoG + سقف بهره‌برداری ۷۵٪',
      method: 'Lever Arm + ΔCoG + Out-of-Level Envelope',
      inputSummary: 'W=30t, DAF=1.1, d1=4m, d2=6m, ±0.5m, 1.5°',
      expectedValue: 19.8,
      actualValue: tandem.crane1NominalLoadTon,
      unit: 'ton',
      absDiff: roundDisplay(absDiff, 4),
      relDiffPct: roundDisplay((absDiff / 19.8) * 100, 3),
      tolerancePct: 0.1,
      passed: absDiff < 0.01 && tandem.crane1WorstCaseLoadTon > 19.8 && tandem.checks.length === 2,
      standardRef: 'ASME P30.1 Sec. 2-3.4',
    });
  }

  // TC-07: Eccentric / Out-of-Polygon CoG MUST FAIL (Never silently clamp!)
  {
    const resOut = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 10,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 2.5, y: 0, z: 0 }, // Attachment points are only at -1.5m and +1.5m!
      hookPosition: { x: 2.5, y: 3, z: 0 },
      attachmentPoints: [
        { id: 'L1', label: 'Left', position: { x: -1.5, y: 0, z: 0 } },
        { id: 'L2', label: 'Right', position: { x: 1.5, y: 0, z: 0 } },
      ],
      slingWllTon: 25,
      shackleWllTon: 25,
    });
    cases.push({
      testId: 'TC-07',
      scenarioGroup: '7. بارگذاری خارج از مرکز شدید (Eccentric Instability)',
      titleFa: 'کشف واژگونی/خروج CoG از محدوده نقاط اتصال بدون Clamping جعلی',
      method: 'Unclamped Lever Ratio t ∉ [0, 1] & Convex Hull Check',
      inputSummary: 'Points [-1.5m, +1.5m], CoG x=+2.5m (Out of support!)',
      expectedValue: 'FAIL (InsidePolygon=false)',
      actualValue: `${resOut.status} (InsidePolygon=${resOut.cogInsideSupportPolygon})`,
      unit: 'state',
      absDiff: 0,
      relDiffPct: 0,
      tolerancePct: 0,
      passed: resOut.status === 'FAIL' && resOut.cogInsideSupportPolygon === false,
      standardRef: 'ASME P30.1 Sec. 2-2.2',
    });
  }

  // TC-08: Equipment Boundaries (Below Min Radius FAIL + Shackle Angular Derating ASME B30.26)
  {
    const belowMinR = evaluateCraneLoadChart(
      { boomLengthM: 30, radiusM: 8, outriggerConfig: '100_OUTRIGGERS', chartPoints: BENCHMARK_CRANE_CHART },
      15
    );
    const shackleDerated = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 10,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 4, z: 0 },
      attachmentPoints: [
        { id: 'L1', label: 'L1', position: { x: -1, y: 0, z: 0 } },
        { id: 'L2', label: 'L2', position: { x: 1, y: 0, z: 0 } },
      ],
      slingWllTon: 12,
      shackleWllTon: 10,
      shackleLateralAngleDeg: 35, // 0.70 derating => effective shackle WLL = 7.0t
    });
    const passed =
      belowMinR.status === 'FAIL' &&
      belowMinR.lookupMethod === 'OUT_OF_RANGE' &&
      Math.abs((shackleDerated.effectiveShackleWllTon || 0) - 7.0) < 0.01 &&
      shackleDerated.shackleAngleDeratingFactor === 0.7;

    cases.push({
      testId: 'TC-08',
      scenarioGroup: '8. شرایط مرزی تجهیزات و شگل (Equipment Boundary)',
      titleFa: 'مرز حداقل شعاع چارت (8m < min 10m) و کاهش ظرفیت زاویه‌ای شگل 35° (×0.70)',
      method: 'Strict Chart Boundary + ASME B30.26 Angular Reduction',
      inputSummary: 'Boom=30m, R=8m (<10m min) | Shackle 10t @ 35° => 7.0t',
      expectedValue: 7.0,
      actualValue: shackleDerated.effectiveShackleWllTon ?? 0,
      unit: 'ton',
      absDiff: Math.abs((shackleDerated.effectiveShackleWllTon ?? 0) - 7.0),
      relDiffPct: 0,
      tolerancePct: 0.01,
      passed,
      standardRef: 'ASME B30.5 Sec. 5-1.1 / ASME B30.26 Sec. 26-1.4',
    });
  }

  // TC-09: Incomplete / Invalid / NaN Inputs -> MUST return NOT_VERIFIED
  {
    const noChart = evaluateCraneLoadChart(
      { boomLengthM: 20, radiusM: 10, outriggerConfig: '100_OUTRIGGERS', chartPoints: [] },
      10
    );
    const noWll = evaluateRiggingAndLoadCases({
      netLoadWeightTon: 10,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.1,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 4, z: 0 },
      attachmentPoints: [
        { id: 'L1', label: 'L1', position: { x: -1, y: 0, z: 0 } },
        { id: 'L2', label: 'L2', position: { x: 1, y: 0, z: 0 } },
      ],
      slingWllTon: null,
      shackleWllTon: null,
    });
    const nanWeight = evaluateRiggingAndLoadCases({
      netLoadWeightTon: NaN,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.1,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 4, z: 0 },
      attachmentPoints: [],
    });
    const passed =
      noChart.status === 'NOT_VERIFIED' &&
      noWll.status === 'NOT_VERIFIED' &&
      noWll.legs.every((l) => l.status === 'NOT_VERIFIED') &&
      nanWeight.status === 'NOT_VERIFIED';

    cases.push({
      testId: 'TC-09',
      scenarioGroup: '9. ورودی ناقص و نامعتبر (Incomplete / NaN Input)',
      titleFa: 'مسدودسازی خودکار در نبود Load Chart / WLL یا ورودی NaN',
      method: 'Strict Null/NaN/Missing Data Guardrails',
      inputSummary: 'Empty Load Chart + Null WLL + NaN NetWeight',
      expectedValue: 'NOT_VERIFIED',
      actualValue: `${noChart.status} / ${noWll.status} / ${nanWeight.status}`,
      unit: 'state',
      absDiff: 0,
      relDiffPct: 0,
      tolerancePct: 0,
      passed,
      standardRef: 'ASME B30.5 / B30.9 / HSECORE Safety Mandate',
    });
  }

  // TC-10: Mandatory FAIL Scenarios + Unit Conversions + Turning + Lug + WRC Domain
  {
    const overUtilCrane = evaluateFullLiftingPlan({
      liftCategory: 'CRITICAL',
      crane: {
        boomLengthM: 20,
        radiusM: 12, // Rated = 30t -> 85% limit = 25.5t
        outriggerConfig: '100_OUTRIGGERS',
        chartPoints: BENCHMARK_CRANE_CHART,
      },
      rigging: {
        netLoadWeightTon: 24,
        riggingAccessoryWeightTon: 0.5,
        hookBlockWeightTon: 0.5,
        dynamicFactor: 1.1, // Hook load = 25 * 1.1 = 27.5t > 25.5t (91.67% > 85% FAIL!)
        cogOffset: { x: 0, y: 0, z: 0 },
        hookPosition: { x: 0, y: 4, z: 0 },
        attachmentPoints: [
          { id: 'L1', label: 'L1', position: { x: -1, y: 0, z: 0 } },
          { id: 'L2', label: 'L2', position: { x: 1, y: 0, z: 0 } },
        ],
        slingWllTon: 20,
        shackleWllTon: 20,
      },
      windSpeedMs: 15.5, // > 13.8 m/s -> FAIL
    });

    // SI Unit Converter accuracy checks (exact round-trip)
    const tonFromKg = toMetricTon(12500, 'kg');
    const kgFromTon = fromMetricTon(tonFromKg, 'kg');
    const mFromFt = toMeters(100, 'ft');
    const ftFromM = fromMeters(mFromFt, 'ft');
    const kpaFromPsi = toKpa(100, 'psi');
    const psiFromKpa = fromKpa(kpaFromPsi, 'psi');
    const mpsFromKnot = toMetersPerSec(20, 'knot');
    const knotFromMps = fromMetersPerSec(mpsFromKnot, 'knot');

    const unitOk =
      Math.abs(kgFromTon - 12500) < 1e-6 &&
      Math.abs(mFromFt - 30.48) < 1e-6 &&
      Math.abs(ftFromM - 100) < 1e-6 &&
      Math.abs(psiFromKpa - 100) < 1e-6 &&
      Math.abs(knotFromMps - 20) < 1e-6;

    // Also verify Turning equilibrium
    const turning = evaluateLiftingAndTurning({
      enabled: true,
      totalWeightTon: 40,
      vesselLengthM: 18,
      cogFromBottomM: 8.5,
      mainLugFromBottomM: 17.5,
      tailLugFromBottomM: 0.5,
      dynamicFactor: 1.1,
      mainCraneCapacityTon: 60,
      tailCraneCapacityTon: 35,
    });

    const passed =
      overUtilCrane.overallStatus === 'FAIL' &&
      overUtilCrane.craneResult.status === 'FAIL' &&
      overUtilCrane.blockers.length >= 2 &&
      turning.phases[6].tailCraneLoadTon === 0 &&
      unitOk;

    cases.push({
      testId: 'TC-10',
      scenarioGroup: '10. سناریوی FAIL اجباری + تبدیل واحدهای SI',
      titleFa: 'تجاوز از ۸۵٪ Load Chart + باد > 13.8 m/s + Turning + دقت SI',
      method: 'Mandatory Safety Rejection + SI Unit Round-Trip + Turning',
      inputSummary: 'Hook=27.5t vs 30t(91.7%>85%), Wind=15.5m/s, Turning 0-90, UnitConversions',
      expectedValue: 'FAIL (91.67%)',
      actualValue: `${overUtilCrane.overallStatus} (${overUtilCrane.craneResult.utilizationPct}%)`,
      unit: '%',
      absDiff: roundDisplay(Math.abs((overUtilCrane.craneResult.utilizationPct || 0) - 91.67), 2),
      relDiffPct: 0.01,
      tolerancePct: 0.1,
      passed,
      standardRef: 'ASME P30.1 / B30.5',
    });
  }

  // TC-11: 3-Leg Spatial Determinate Equilibrium + 6-DOF Residuals Convergence
  {
    const res3 = evaluateRiggingAndLoadCases({
      arrangementType: 'THREE_LEG',
      netLoadWeightTon: 15,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 0.15, y: 0, z: 0.1 },
      hookPosition: { x: 0.15, y: 3.6, z: 0.1 },
      attachmentPoints: [
        { id: 'A1', label: 'A1', position: { x: 2.0, y: 0, z: 0.0 } },
        { id: 'A2', label: 'A2', position: { x: -1.2, y: 0, z: 1.8 } },
        { id: 'A3', label: 'A3', position: { x: -1.2, y: 0, z: -1.8 } },
      ],
      slingWllTon: 12,
      shackleWllTon: 12,
    });
    const sumVert = res3.legs.reduce((s, l) => s + l.verticalShareTon, 0);
    const passed =
      res3.staticEquilibrium.determinacyClassification === 'DETERMINATE' &&
      res3.staticEquilibrium.solutionMethod === 'STATIC_EQUILIBRIUM_EXACT' &&
      res3.staticEquilibrium.residuals.converged === true &&
      res3.staticEquilibrium.residuals.maxForceResidualTon < 1e-3 &&
      res3.staticEquilibrium.residuals.maxMomentResidualTonM < 1e-2 &&
      Math.abs(sumVert - 15) < 0.02 &&
      res3.legs[0].axialTensionTon > res3.legs[2].axialTensionTon &&
      res3.status === 'PASS';

    cases.push({
      testId: 'TC-11',
      scenarioGroup: '11. تعادل فضایی ۳ شاخه معین و باقیمانده ۶ درجه آزادی',
      titleFa: 'حل سیستم ۳ شاخه نامتقارن با برون‌محوری CoG و ارضای باقیمانده ۶-DOF',
      method: '3x3 Spatial Vector Equilibrium + 6-DOF Residual Verification',
      inputSummary: 'W=15t, 3-Leg Asymmetric Triangle, CoG=(0.15, 0, 0.10)',
      expectedValue: 'DETERMINATE (ΣFy=0, Res<1e-3)',
      actualValue: `${res3.staticEquilibrium.determinacyClassification} (ResF=${res3.staticEquilibrium.residuals.maxForceResidualTon}t)`,
      unit: 'ton',
      absDiff: res3.staticEquilibrium.residuals.maxForceResidualTon,
      relDiffPct: 0,
      tolerancePct: 0.1,
      passed,
      standardRef: 'ASME P30.1 / Static Equilibrium 6-DOF',
    });
  }

  // TC-12: 4-Leg Indeterminate Stiffness Compatibility + Length Tolerance (+8mm)
  {
    const resStiff = evaluateRiggingAndLoadCases({
      arrangementType: 'FOUR_LEG',
      netLoadWeightTon: 24,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 3.5, z: 0 },
      attachmentPoints: [
        { id: 'L1', label: 'L1 (+X,+Z)', position: { x: 1.5, y: 0, z: 1.0 }, axialStiffnessKn: 48000, lengthToleranceMm: 8 },
        { id: 'L2', label: 'L2 (-X,+Z)', position: { x: -1.5, y: 0, z: 1.0 }, axialStiffnessKn: 48000, lengthToleranceMm: 0 },
        { id: 'L3', label: 'L3 (-X,-Z)', position: { x: -1.5, y: 0, z: -1.0 }, axialStiffnessKn: 48000, lengthToleranceMm: 0 },
        { id: 'L4', label: 'L4 (+X,-Z)', position: { x: 1.5, y: 0, z: -1.0 }, axialStiffnessKn: 48000, lengthToleranceMm: 0 },
      ],
      slingWllTon: 18,
      shackleWllTon: 18,
    });
    const tL1 = resStiff.legs[0].axialTensionTon;
    const tL2 = resStiff.legs[1].axialTensionTon;
    const tL3 = resStiff.legs[2].axialTensionTon;
    const passed =
      resStiff.staticEquilibrium.determinacyClassification === 'INDETERMINATE' &&
      resStiff.staticEquilibrium.solutionMethod === 'STIFFNESS_COMPATIBILITY_ACTIVE_SET' &&
      resStiff.staticEquilibrium.stiffnessDataComplete === true &&
      resStiff.staticEquilibrium.residuals.converged === true &&
      tL1 < tL2 &&
      tL3 < tL2 && // +8mm on L1 unloads the L1-L3 diagonal onto the stiff L2-L4 diagonal!
      Math.abs(tL1 - tL3) < 0.05 &&
      resStiff.status === 'PASS';

    cases.push({
      testId: 'TC-12',
      scenarioGroup: '12. سازگاری سختی سیستم نامعین ۴ شاخه با تلورانس طول',
      titleFa: 'حل سیستم ۴ شاخه با سختی محوری EA و تلورانس +8mm (بدون فرض مساوی W/4)',
      method: 'Matrix Stiffness & Compatibility K·Δ = F + ΔL',
      inputSummary: 'W=24t, EA=48000kN, Leg1 ΔL=+8mm',
      expectedValue: 'L1=L3 < L2=L4 (Diagonal Load Shift)',
      actualValue: `L1=${tL1}t, L2=${tL2}t, L3=${tL3}t`,
      unit: 'ton',
      absDiff: roundDisplay(Math.abs(tL2 - tL1), 3),
      relDiffPct: 0,
      tolerancePct: 0.1,
      passed,
      standardRef: 'ASME B30.9 / Stiffness Compatibility',
    });
  }

  // TC-13: 4-Leg Indeterminate Missing Stiffness & No Equalizer -> Strictly NOT_VERIFIED
  {
    const resMissing = evaluateRiggingAndLoadCases({
      arrangementType: 'FOUR_LEG',
      netLoadWeightTon: 20,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0, y: 3.5, z: 0 },
      attachmentPoints: [
        { id: 'P1', label: 'P1', position: { x: 1.5, y: 0, z: 1.0 } },
        { id: 'P2', label: 'P2', position: { x: -1.5, y: 0, z: 1.0 } },
        { id: 'P3', label: 'P3', position: { x: -1.5, y: 0, z: -1.0 } },
        { id: 'P4', label: 'P4', position: { x: 1.5, y: 0, z: -1.0 } },
      ],
      slingWllTon: 15,
      shackleWllTon: 15,
      enforceThreeLegEffectiveForFourLeg: false,
    });
    const passed =
      resMissing.status === 'NOT_VERIFIED' &&
      resMissing.staticEquilibrium.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' &&
      resMissing.staticEquilibrium.missingDataFields.length > 0 &&
      resMissing.blockers.some((b) => b.includes('نامعین')) &&
      resMissing.legs.every((l) => l.participationStatus === 'UNVERIFIED');

    cases.push({
      testId: 'TC-13',
      scenarioGroup: '13. امتناع از تقسیم مساوی W/4 در نبود سختی سیستم نامعین',
      titleFa: 'بازگشت وضعیت قطعی NOT_VERIFIED برای ۴ شاخه فاقد سختی EA یا Equalizer',
      method: 'Strict Determinacy Gatekeeper (Zero Blind Equal-Split)',
      inputSummary: '4-Leg without EA, E, Area, or Equalizer',
      expectedValue: 'NOT_VERIFIED (No W/4 guess)',
      actualValue: `${resMissing.status} (${resMissing.staticEquilibrium.solutionMethod})`,
      unit: 'state',
      absDiff: 0,
      relDiffPct: 0,
      tolerancePct: 0,
      passed,
      standardRef: 'Engineering Safety Mandate / ASME B30.9',
    });
  }

  // TC-14: Nonlinear Tension-Only Active-Set Slack-Sling Detection (+60mm excess length on L1)
  {
    const resSlack = evaluateRiggingAndLoadCases({
      arrangementType: 'FOUR_LEG',
      netLoadWeightTon: 20,
      riggingAccessoryWeightTon: 0,
      hookBlockWeightTon: 0,
      dynamicFactor: 1.0,
      cogOffset: { x: -0.25, y: 0, z: -0.15 },
      hookPosition: { x: -0.25, y: 3.5, z: -0.15 },
      attachmentPoints: [
        { id: 'L1', label: 'L1 (+X,+Z)', position: { x: 1.5, y: 0, z: 1.0 }, elasticModulusGpa: 110, metallicAreaMm2: 320, lengthToleranceMm: 60 },
        { id: 'L2', label: 'L2 (-X,+Z)', position: { x: -1.5, y: 0, z: 1.0 }, elasticModulusGpa: 110, metallicAreaMm2: 320, lengthToleranceMm: 0 },
        { id: 'L3', label: 'L3 (-X,-Z)', position: { x: -1.5, y: 0, z: -1.0 }, elasticModulusGpa: 110, metallicAreaMm2: 320, lengthToleranceMm: 0 },
        { id: 'L4', label: 'L4 (+X,-Z)', position: { x: 1.5, y: 0, z: -1.0 }, elasticModulusGpa: 110, metallicAreaMm2: 320, lengthToleranceMm: 0 },
      ],
      slingWllTon: 20,
      shackleWllTon: 20,
    });
    const leg1 = resSlack.legs[0];
    const passed =
      resSlack.staticEquilibrium.noCompressionVerified === true &&
      resSlack.staticEquilibrium.slackLegIds.includes('L1') &&
      leg1.participationStatus === 'SLACK' &&
      leg1.axialTensionTon === 0 &&
      resSlack.staticEquilibrium.residuals.converged === true;

    cases.push({
      testId: 'TC-14',
      scenarioGroup: '14. حلگر غیرخطی تک‌سویه کششی و تشخیص شاخه شل (Slack)',
      titleFa: 'حذف شاخه دارای شل‌شدگی (+60mm) بدون تولید نیروی فشاری منفی',
      method: 'Tension-Only Active-Set Iteration (T ≥ 0)',
      inputSummary: 'W=20t, E=110GPa, A=320mm², L1 ΔL=+60mm & eccentric CoG',
      expectedValue: 'L1 SLACK (T=0, No Compression)',
      actualValue: `L1=${leg1.participationStatus} (${leg1.axialTensionTon}t), Active=${resSlack.staticEquilibrium.activeLegCount}`,
      unit: 'ton',
      absDiff: leg1.axialTensionTon,
      relDiffPct: 0,
      tolerancePct: 0,
      passed,
      standardRef: 'ASME P30.1 / Unilateral Tension-Only Equilibrium',
    });
  }

  // TC-15: Equalizer Indeterminacy Reduction + Composite CoG + Parametric Sensitivity Analysis
  {
    const resEq = evaluateRiggingAndLoadCases({
      arrangementType: 'FOUR_LEG',
      hasEqualizer: true,
      equalizerPairs: [
        ['L1', 'L2'],
        ['L3', 'L4'],
      ],
      netLoadWeightTon: 20,
      riggingAccessoryWeightTon: 0.4,
      hookBlockWeightTon: 0.6,
      spreaderBeamWeightTon: 1.0,
      weightComponents: [
        { id: 'W1', label: 'بدنه اصلی مبدل', category: 'LOAD', weightTon: 16, cogPosition: { x: 0.2, y: 0, z: 0 } },
        { id: 'W2', label: 'فلنج و تجهیزات جانبی', category: 'AUX', weightTon: 4, cogPosition: { x: 0.8, y: 0, z: 0.5 } },
        { id: 'W3', label: 'تیر توزیع Spreader', category: 'SPREADER', weightTon: 1.0, cogPosition: { x: 0, y: 2.0, z: 0 } },
      ],
      dynamicFactor: 1.1,
      cogOffset: { x: 0, y: 0, z: 0 },
      hookPosition: { x: 0.305, y: 4.5, z: 0.095 },
      attachmentPoints: [
        { id: 'L1', label: 'L1', position: { x: 1.8, y: 0.5, z: 1.0 } },
        { id: 'L2', label: 'L2', position: { x: 1.8, y: 0.5, z: -1.0 } },
        { id: 'L3', label: 'L3', position: { x: -1.8, y: 0.5, z: -1.0 } },
        { id: 'L4', label: 'L4', position: { x: -1.8, y: 0.5, z: 1.0 } },
      ],
      slingWllTon: 15,
      shackleWllTon: 15,
      sensitivityUncertainties: { weightPct: 5, cogShiftM: 0.25, hookHeightDeltaM: 0.5 },
    });
    // Composite CoG X = (16*0.2 + 4*0.8 + 1*0) / 21 = 6.4 / 21 = 0.3048 m
    const expectedCogX = 6.4 / 21;
    const cogDiff = Math.abs(resEq.compositeCogM.x - expectedCogX);
    const passed =
      resEq.staticEquilibrium.determinacyClassification === 'EQUALIZER_REDUCED' &&
      resEq.staticEquilibrium.solutionMethod === 'EQUALIZER_BALANCED_EQUILIBRIUM' &&
      cogDiff < 0.005 &&
      resEq.sensitivityAnalysis.impacts.length >= 4 &&
      resEq.sensitivityAnalysis.worstCaseLegTensionTon > resEq.governingLegTensionTon;

    cases.push({
      testId: 'TC-15',
      scenarioGroup: '15. ترکیب CoG، سیستم Equalizer و تحلیل حساسیت پارامتریک',
      titleFa: 'محاسبه CoG مرکب، کاهش نامعینی با Equalizer و رتبه‌بندی حساسیت',
      method: 'Weighted Composite CoG + Equalizer Reduction + Parametric Sensitivity',
      inputSummary: '3 Weight Components, 4-Leg Equalizer Pairs (L1-L2, L3-L4), Uncertainties',
      expectedValue: `CoG.x=${roundDisplay(expectedCogX, 3)}m | EQUALIZER_REDUCED`,
      actualValue: `CoG.x=${resEq.compositeCogM.x}m | GovSens=${resEq.sensitivityAnalysis.governingParameterKey} (+${resEq.sensitivityAnalysis.maxImpactPct}%)`,
      unit: 'm',
      absDiff: roundDisplay(cogDiff, 4),
      relDiffPct: roundDisplay((cogDiff / expectedCogX) * 100, 3),
      tolerancePct: 0.5,
      passed,
      standardRef: 'ASME P30.1 / B30.9 Equalizer & Sensitivity',
    });
  }

  const passedCases = cases.filter((c) => c.passed).length;
  return {
    engineVersion: LIFTING_ENGINE_VERSION,
    executedAt: new Date().toISOString(),
    totalCases: cases.length,
    passedCases,
    failedCases: cases.length - passedCases,
    allPassed: passedCases === cases.length,
    cases,
  };
}
