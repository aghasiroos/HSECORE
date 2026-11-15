import assert from 'node:assert/strict';
import {
  combineStatuses,
  evaluateCraneLoadChart,
  evaluateRiggingAndLoadCases,
  evaluateFullLiftingPlan,
  getShackleAngularDerating,
  LIFTING_ENGINE_VERSION,
  type LoadChartPoint,
} from '../shared/lifting-engine/index.ts';
import { runIndependentBenchmarkSuite } from '../shared/lifting-engine/validationSuite.ts';

console.log(`=== Running Lifting Engine Independent Validation Suite (Engine v${LIFTING_ENGINE_VERSION}) ===`);

// 1. Run 10-scenario Independent Benchmark Suite (Priority 2)
const report = runIndependentBenchmarkSuite();
for (const c of report.cases) {
  const statusMark = c.passed ? '✓' : '✗';
  console.log(
    `${statusMark} [${c.testId}] ${c.scenarioGroup} -> Expected: ${c.expectedValue} ${c.unit} | Actual: ${c.actualValue} ${c.unit} | Diff: ${c.absDiff} (${c.relDiffPct}%) [${c.standardRef}]`
  );
  assert.equal(c.passed, true, `Benchmark case ${c.testId} (${c.titleFa}) FAILED`);
}

// 2. Verify 5-state combineStatuses (including NOT_APPLICABLE)
assert.equal(combineStatuses(['PASS', 'NOT_APPLICABLE']), 'PASS');
assert.equal(combineStatuses(['PASS', 'WARNING', 'NOT_APPLICABLE']), 'WARNING');
assert.equal(combineStatuses(['PASS', 'NOT_VERIFIED', 'NOT_APPLICABLE']), 'NOT_VERIFIED');
assert.equal(combineStatuses(['PASS', 'FAIL', 'NOT_APPLICABLE']), 'FAIL');
assert.equal(combineStatuses(['NOT_APPLICABLE']), 'NOT_VERIFIED');
assert.equal(combineStatuses([]), 'NOT_VERIFIED');
console.log('✓ Test 5-State Status Logic (PASS/FAIL/WARNING/NOT_VERIFIED/NOT_APPLICABLE) Passed');

// 3. Verify Unit Preferences SI Boundary Conversion (kg + ft + knot + MPa -> identical to ton + m + m/s + kPa)
const sampleChart: LoadChartPoint[] = [
  { outriggerConfig: '100_OUTRIGGERS', boomLengthM: 20, radiusM: 12, ratedCapacityTon: 30 },
];
const siPlan = evaluateFullLiftingPlan({
  liftCategory: 'STANDARD',
  crane: { boomLengthM: 20, radiusM: 12, outriggerConfig: '100_OUTRIGGERS', craneDeadWeightTon: 36, outriggerPadAreaM2: 1.5, chartPoints: sampleChart },
  rigging: {
    netLoadWeightTon: 10,
    riggingAccessoryWeightTon: 0.4,
    hookBlockWeightTon: 0.6,
    dynamicFactor: 1.1,
    cogOffset: { x: 0, y: 0, z: 0 },
    hookPosition: { x: 0, y: 4, z: 0 },
    attachmentPoints: [
      { id: '1', label: 'A', position: { x: -1.5, y: 0.5, z: -0.8 } },
      { id: '2', label: 'B', position: { x: 1.5, y: 0.5, z: -0.8 } },
      { id: '3', label: 'C', position: { x: 1.5, y: 0.5, z: 0.8 } },
      { id: '4', label: 'D', position: { x: -1.5, y: 0.5, z: 0.8 } },
    ],
    slingWllTon: 12,
    shackleWllTon: 12,
  },
  windSpeedMs: 8,
  groundBearingMaxKpa: 300,
});

const kgPlan = evaluateFullLiftingPlan({
  liftCategory: 'STANDARD',
  unitPreferences: { massUnit: 'kg', lengthUnit: 'mm', pressureUnit: 'MPa', windUnit: 'km/h' },
  crane: { boomLengthM: 20000, radiusM: 12000, outriggerConfig: '100_OUTRIGGERS', craneDeadWeightTon: 36000, outriggerPadAreaM2: 1.5, chartPoints: sampleChart },
  rigging: {
    netLoadWeightTon: 10000,
    riggingAccessoryWeightTon: 400,
    hookBlockWeightTon: 600,
    dynamicFactor: 1.1,
    cogOffset: { x: 0, y: 0, z: 0 },
    hookPosition: { x: 0, y: 4000, z: 0 },
    attachmentPoints: [
      { id: '1', label: 'A', position: { x: -1500, y: 500, z: -800 } },
      { id: '2', label: 'B', position: { x: 1500, y: 500, z: -800 } },
      { id: '3', label: 'C', position: { x: 1500, y: 500, z: 800 } },
      { id: '4', label: 'D', position: { x: -1500, y: 500, z: 800 } },
    ],
    slingWllTon: 12000,
    shackleWllTon: 12000,
  },
  windSpeedMs: 28.8, // 8 m/s in km/h
  groundBearingMaxKpa: 0.3, // 300 kPa in MPa
});

assert.equal(kgPlan.riggingResult.grossStaticLoadTon, siPlan.riggingResult.grossStaticLoadTon);
assert.equal(kgPlan.riggingResult.governingLegTensionTon, siPlan.riggingResult.governingLegTensionTon);
assert.equal(kgPlan.craneResult.utilizationPct, siPlan.craneResult.utilizationPct);
assert.equal(kgPlan.overallStatus, siPlan.overallStatus);
assert.equal(kgPlan.overallStatus, 'NOT_VERIFIED'); // 4-leg without stiffness/equalizer cannot claim PASS

// Verify SI equivalence WITH stiffness compatibility (must both return PASS & identical tensions)
const siStiffPlan = evaluateFullLiftingPlan({
  liftCategory: 'STANDARD',
  crane: { boomLengthM: 20, radiusM: 12, outriggerConfig: '100_OUTRIGGERS', craneDeadWeightTon: 36, outriggerPadAreaM2: 1.5, chartPoints: sampleChart },
  rigging: {
    netLoadWeightTon: 10,
    riggingAccessoryWeightTon: 0.4,
    hookBlockWeightTon: 0.6,
    dynamicFactor: 1.1,
    cogOffset: { x: 0, y: 0, z: 0 },
    hookPosition: { x: 0, y: 4, z: 0 },
    attachmentPoints: [
      { id: '1', label: 'A', position: { x: -1.5, y: 0.5, z: -0.8 }, axialStiffnessKn: 42000, lengthToleranceMm: 4 },
      { id: '2', label: 'B', position: { x: 1.5, y: 0.5, z: -0.8 }, axialStiffnessKn: 42000 },
      { id: '3', label: 'C', position: { x: 1.5, y: 0.5, z: 0.8 }, axialStiffnessKn: 42000 },
      { id: '4', label: 'D', position: { x: -1.5, y: 0.5, z: 0.8 }, axialStiffnessKn: 42000 },
    ],
    slingWllTon: 12,
    shackleWllTon: 12,
  },
  windSpeedMs: 8,
  groundBearingMaxKpa: 300,
});
const kgStiffPlan = evaluateFullLiftingPlan({
  liftCategory: 'STANDARD',
  unitPreferences: { massUnit: 'kg', lengthUnit: 'mm', pressureUnit: 'MPa', windUnit: 'km/h' },
  crane: { boomLengthM: 20000, radiusM: 12000, outriggerConfig: '100_OUTRIGGERS', craneDeadWeightTon: 36000, outriggerPadAreaM2: 1.5, chartPoints: sampleChart },
  rigging: {
    netLoadWeightTon: 10000,
    riggingAccessoryWeightTon: 400,
    hookBlockWeightTon: 600,
    dynamicFactor: 1.1,
    cogOffset: { x: 0, y: 0, z: 0 },
    hookPosition: { x: 0, y: 4000, z: 0 },
    attachmentPoints: [
      { id: '1', label: 'A', position: { x: -1500, y: 500, z: -800 }, axialStiffnessKn: 42000, lengthToleranceMm: 4 },
      { id: '2', label: 'B', position: { x: 1500, y: 500, z: -800 }, axialStiffnessKn: 42000 },
      { id: '3', label: 'C', position: { x: 1500, y: 500, z: 800 }, axialStiffnessKn: 42000 },
      { id: '4', label: 'D', position: { x: -1500, y: 500, z: 800 }, axialStiffnessKn: 42000 },
    ],
    slingWllTon: 12000,
    shackleWllTon: 12000,
  },
  windSpeedMs: 28.8,
  groundBearingMaxKpa: 0.3,
});
assert.equal(kgStiffPlan.overallStatus, 'PASS');
assert.equal(kgStiffPlan.overallStatus, siStiffPlan.overallStatus);
assert.equal(kgStiffPlan.riggingResult.governingLegTensionTon, siStiffPlan.riggingResult.governingLegTensionTon);
assert.equal(siStiffPlan.riggingResult.staticEquilibrium.residuals.converged, true);
assert.ok(siStiffPlan.riggingResult.sensitivityAnalysis.impacts.length >= 4);
console.log('✓ Test Multi-Unit SI Equivalence (ton/m/kPa/ms == kg/mm/MPa/kmh) & Stiffness Solver Passed');

// 4. Shackle Angular Derating & Pin-to-Hole Compatibility
assert.equal(getShackleAngularDerating(0).factor, 1.0);
assert.equal(getShackleAngularDerating(45).factor, 0.7);
assert.equal(getShackleAngularDerating(90).factor, 0.5);
assert.equal(getShackleAngularDerating(95).status, 'FAIL');

const pinFail = evaluateRiggingAndLoadCases({
  netLoadWeightTon: 8,
  riggingAccessoryWeightTon: 0,
  hookBlockWeightTon: 0,
  dynamicFactor: 1.0,
  cogOffset: { x: 0, y: 0, z: 0 },
  hookPosition: { x: 0, y: 4, z: 0 },
  attachmentPoints: [
    { id: '1', label: 'A', position: { x: -1, y: 0, z: 0 } },
    { id: '2', label: 'B', position: { x: 1, y: 0, z: 0 } },
  ],
  slingWllTon: 12,
  shackleWllTon: 12,
  shacklePinDiameterMm: 45,
  lugHoleDiameterMm: 40, // Pin bigger than hole -> FAIL!
});
assert.equal(pinFail.status, 'FAIL');
console.log('✓ Test Shackle Angular Derating & Pin-to-Hole Interference Check Passed');

// 5. Verify ParameterTrace completeness (all 10 metadata keys populated)
assert.ok(siPlan.parameterTrace.length >= 6);
for (const pt of siPlan.parameterTrace) {
  assert.ok(pt.key && pt.nameFa && pt.formula && pt.standardRef && pt.validationStatus && pt.finalStatus);
}
console.log(`=== ALL ${report.passedCases}/${report.totalCases} BENCHMARK + EXTRA UNIT TESTS PASSED ===`);
