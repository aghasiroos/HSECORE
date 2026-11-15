import assert from 'node:assert/strict';
import {
  runNfpaFloorCalculation,
  computeCoverageGrid,
  detectOverDensityConflicts,
  ExistingEquipmentSummaryItem,
} from '../src/modules/fire-dept/fire-design/nfpaEngine';
import {
  ALL_EIGHT_FIRE_SYSTEMS,
  FIRE_SYSTEM_PLUGINS,
  getSystemPlugin,
} from '../src/modules/fire-dept/fire-design/systemsRegistry';
import { computeBuildingDesignSummary } from '../src/modules/fire-dept/fire-design/systemMetricsHelper';
import {
  getConflictingWaterFieldWarnings,
  resolveWaterSourceType,
  sanitizeWaterSupply,
} from '../src/modules/fire-dept/fire-design/waterSupplyUtils';
import type { FireDesignBuilding, FireDesignFloor } from '../src/modules/fire-dept/fire-design/types';

function makeBaseBuilding(overrides: Partial<FireDesignBuilding> = {}): FireDesignBuilding {
  return {
    id: 1,
    code: 'BLD-TEST-01',
    name: 'ساختمان تست مهندسی',
    companyName: 'مجتمع پتروشیمی رجال',
    unitName: 'واحد پلی‌اتیلن',
    occupancyType: 'ADMINISTRATIVE',
    nfpa13Edition: '2022',
    nfpa10Edition: '2022',
    floorsAboveGround: 2,
    basementFloors: 0,
    structureType: 'CONCRETE',
    ceilingType: 'FLAT_UNOBSTRUCTED',
    storedMaterials: 'مبلمان اداری و اسناد کاغذی',
    hazardNature: ['A'],
    riskLevelOverride: 'AUTO',
    occupantLoad: 40,
    activityType: 'امور اداری و مهندسی',
    waterSupply: {
      isAvailable: true,
      tankCapacityLiters: 120000,
      pumpRatedFlowGpm: 600,
      pumpRatedPressureBar: 8.5,
      staticPressureBar: 6.0,
      riserDiameterMm: 100,
      pipeMaterial: 'BLACK_STEEL_WET',
    },
    status: 'DRAFT',
    ...overrides,
  };
}

function makeBaseFloor(overrides: Partial<FireDesignFloor> = {}): FireDesignFloor {
  return {
    id: 10,
    buildingId: 1,
    floorCode: 'GF',
    floorLabel: 'همکف',
    floorOrder: 0,
    isBasement: false,
    lengthM: 24,
    widthM: 16,
    ceilingHeightM: 3.6,
    areaSqm: 384,
    falseCeilingHeightM: 0,
    beamDepthM: 0,
    beamSpacingM: 0,
    spaces: [],
    obstacles: [],
    ...overrides,
  };
}

// 1. Test Incomplete Data Gatekeeper
{
  const b = makeBaseBuilding({ storedMaterials: '', hazardNature: [] });
  const f = makeBaseFloor({ lengthM: 0, areaSqm: 0 });
  const res = runNfpaFloorCalculation({ building: b, floor: f });
  assert.equal(res.calculationStatus, 'INCOMPLETE_DATA');
  assert.ok(res.missingRequiredFields.length >= 3);
  assert.equal(res.sprinkler.calculatedHeadCount, 0);
  console.log('✓ Test 1 Passed: Incomplete data gatekeeper blocks fake calculations.');
}

// 2. Test Missing Water Supply Gatekeeper (never fakes PASS)
{
  const b = makeBaseBuilding({
    waterSupply: { isAvailable: true, tankCapacityLiters: null, pumpRatedFlowGpm: null },
  });
  const f = makeBaseFloor();
  const res = runNfpaFloorCalculation({ building: b, floor: f });
  assert.equal(res.calculationStatus, 'PARTIAL_WATER_DATA');
  assert.equal(res.sprinkler.hydraulics.waterSupplyStatus, 'NEEDS_WATER_DATA');
  assert.ok(res.sprinkler.hydraulics.missingWaterFields.length >= 2);
  console.log('✓ Test 2 Passed: Missing water supply triggers NEEDS_WATER_DATA instead of fake PASS.');
}

// 3. Test Light Hazard (2016 vs 2022) + Obstructions + Hydraulics
{
  const b2016 = makeBaseBuilding({ nfpa13Edition: '2016', ceilingType: 'EXPOSED_BEAMS' });
  const b2022 = makeBaseBuilding({ nfpa13Edition: '2022', ceilingType: 'SUSPENDED_CEILING' });
  const f = makeBaseFloor({ beamDepthM: 0.35, falseCeilingHeightM: 0.6 });

  const r16 = runNfpaFloorCalculation({ building: b2016, floor: f });
  const r22 = runNfpaFloorCalculation({ building: b2022, floor: f });

  assert.equal(r16.hazardGroup, 'LIGHT');
  assert.equal(r22.hazardGroup, 'LIGHT');
  assert.ok(r16.sprinkler.calculatedHeadCount >= 20);
  assert.ok(r16.sprinkler.obstructionAlerts.length >= 2);
  assert.equal(r22.sprinkler.hydraulics.waterSupplyStatus, 'ADEQUATE');
  assert.ok(r16.complianceChecks[0].clause.includes('2016'));
  assert.ok(r22.complianceChecks[0].clause.includes('2022'));
  console.log('✓ Test 3 Passed: NFPA 13 (2016 vs 2022), beam/false-ceiling obstructions & hydraulics verified.');
}

// 4. Test Extra Hazard Group 2 (Petrochemical Process) + Inadequate Pump/Tank detection
{
  const b = makeBaseBuilding({
    occupancyType: 'INDUSTRIAL_PROCESS',
    storedMaterials: 'هیدروکربن‌های سبک، حلال‌های آلی و اتیلن',
    hazardNature: ['B', 'C'],
    waterSupply: {
      isAvailable: true,
      tankCapacityLiters: 40000,
      pumpRatedFlowGpm: 350,
      pumpRatedPressureBar: 3.0,
      staticPressureBar: 2.5,
    },
  });
  const f = makeBaseFloor({ lengthM: 40, widthM: 25, areaSqm: 1000, ceilingHeightM: 10.5 });
  const res = runNfpaFloorCalculation({ building: b, floor: f });
  assert.equal(res.hazardGroup, 'EH2');
  assert.equal(res.sprinkler.hydraulics.waterSupplyStatus, 'INADEQUATE');
  assert.ok(res.sprinkler.obstructionAlerts.some((a) => a.includes('۹.۱ متر')));
  console.log('✓ Test 4 Passed: EH2 petrochemical hazard, high ceiling alert & undersized tank/pump detected.');
}

// 5. Test Server Room / Class C Compatibility & Existing Water Extinguisher Rejection + Partition Blind Spot
{
  const b = makeBaseBuilding({
    occupancyType: 'SERVER_ROOM',
    unitName: 'اتاق سرور مرکزی',
    storedMaterials: 'رک‌های سرور، UPS و تابلوهای برق',
    hazardNature: ['C'],
  });
  const f = makeBaseFloor({
    lengthM: 25,
    widthM: 15,
    areaSqm: 375,
    obstacles: [
      {
        id: 'wall-1',
        type: 'WALL',
        label: 'دیوار عایق وسط',
        xM: 12.5,
        yM: 0,
        widthM: 0.3,
        heightM: 15,
        blocksSprinkler: true,
        blocksTravel: true,
      },
    ],
  });

  const existingEq: ExistingEquipmentSummaryItem[] = [
    {
      id: 'eq-1',
      code: 'EXT-W-01',
      category: 'Fire Extinguisher Capsol',
      location: 'اتاق سرور مرکزی',
      unit: 'اتاق سرور مرکزی',
      type: 'آب تحت فشار (Water)',
      operationalStatus: 'فعال',
    },
  ];

  const res = runNfpaFloorCalculation({
    building: b,
    floor: f,
    existingEquipment: existingEq,
    placedItems: [
      {
        id: 'ext-left',
        kind: 'EXTINGUISHER_PROPOSED',
        origin: 'PROPOSED',
        code: 'FE-GF-01',
        label: 'CO2 6kg',
        xM: 2,
        yM: 2,
        coverageRadiusM: 15,
      },
    ],
  });

  assert.equal(res.sprinkler.isRequiredOrRecommended, false);
  assert.ok(res.comparisonRows.some((r) => r.status === 'INCOMPATIBLE' && r.incompatibleCount === 1));
  assert.ok(res.uncoveredZones.length > 0, 'Expected blind spot on blocked side of partition wall');
  console.log('✓ Test 5 Passed: Server room non-water preference, existing water incompatibility & partition blind-spot verified.');
}

// 6. Test Smart 4-Color Coverage Grid & Over-Density (< 1.8m Cold Soldering)
{
  const b = makeBaseBuilding();
  const f = makeBaseFloor({
    lengthM: 20,
    widthM: 12,
    areaSqm: 240,
    obstacles: [
      {
        id: 'shaft-1',
        type: 'SHAFT',
        label: 'شفت تاسیسات',
        xM: 10,
        yM: 5,
        widthM: 3,
        heightM: 3,
        blocksSprinkler: true,
        blocksTravel: true,
      },
    ],
  });
  const baseCalc = runNfpaFloorCalculation({ building: b, floor: f });
  assert.ok((baseCalc.overallCompliancePercent ?? 0) > 60);

  const itemsWithConflict = [
    ...baseCalc.suggestedItems,
    {
      id: 'sp-close-1',
      kind: 'SPRINKLER_PROPOSED' as const,
      origin: 'PROPOSED' as const,
      code: 'SP-C1',
      label: 'Test Close 1',
      xM: 4.0,
      yM: 4.0,
      coverageRadiusM: 3,
    },
    {
      id: 'sp-close-2',
      kind: 'SPRINKLER_PROPOSED' as const,
      origin: 'PROPOSED' as const,
      code: 'SP-C2',
      label: 'Test Close 2',
      xM: 4.8,
      yM: 4.0,
      coverageRadiusM: 3,
    },
  ];
  const od = detectOverDensityConflicts(itemsWithConflict);
  assert.ok(od.count >= 1, 'Expected cold soldering conflict when sprinklers < 1.8m');

  const grid = computeCoverageGrid({
    building: b,
    floor: f,
    calc: baseCalc,
    placedItems: itemsWithConflict,
    filters: { sprinkler: true, extinguisher: true, hydrant: false, alarm: false, cleanAgent: false },
  });
  assert.ok(grid.some((c) => c.status === 'GREEN'), 'Expected GREEN cells');
  assert.ok(grid.some((c) => c.status === 'YELLOW'), 'Expected YELLOW cells near cold-soldering sprinklers');
  assert.ok(grid.some((c) => c.status === 'GRAY'), 'Expected GRAY cells inside structural shaft');
  console.log('✓ Test 6 Passed: Smart 4-color coverage grid (GREEN/YELLOW/GRAY) & cold-soldering detector verified.');
}

// 7. Test Unified 8-System Registry & All 6 Extensible NFPA Plugins (14, 11, 2001, 72, 20, 22)
{
  assert.equal(ALL_EIGHT_FIRE_SYSTEMS.length, 8);
  assert.equal(FIRE_SYSTEM_PLUGINS.length, 6);
  const b = makeBaseBuilding();
  const f = makeBaseFloor({ lengthM: 30, widthM: 20, areaSqm: 600 });

  const hyd = getSystemPlugin('STANDPIPE_HYDRANT_NFPA14')!.evaluate({
    building: b,
    floor: f,
    edition: '2024',
    inputs: { standpipeClass: 'CLASS_III', hoseLengthM: 30, riserCount: 2, availablePressureBar: 7.5 },
  });
  assert.equal(hyd.complianceStatus, 'COMPLIANT');
  assert.ok(hyd.suggestedItems.length >= 2);

  const foamBad = getSystemPlugin('FOAM_NFPA11')!.evaluate({
    building: b,
    floor: f,
    edition: '2021',
    inputs: { fuelType: 'POLAR_SOLVENT', hazardAreaSqm: 200, concentratePercent: '1' },
  });
  assert.equal(foamBad.complianceStatus, 'NON_COMPLIANT');

  const clean = getSystemPlugin('CLEAN_AGENT_NFPA2001')!.evaluate({
    building: b,
    floor: f,
    edition: '2022',
    inputs: { agentName: 'FK_5_1_12', roomAreaSqm: 60, roomHeightM: 3.5, isNormallyOccupied: true, doorFanTested: true },
  });
  assert.equal(clean.complianceStatus, 'COMPLIANT');
  assert.ok(clean.suggestedItems.length >= 2);

  const alarm = getSystemPlugin('FIRE_ALARM_NFPA72')!.evaluate({
    building: b,
    floor: f,
    edition: '2022',
    inputs: { detectorType: 'SMOKE', panelType: 'ADDRESSABLE', exitsCount: 2 },
  });
  assert.equal(alarm.complianceStatus, 'COMPLIANT');
  assert.ok(alarm.suggestedItems.some((i) => i.kind === 'DETECTOR_SMOKE'));

  const pumpBad = getSystemPlugin('PUMP_NFPA20')!.evaluate({
    building: b,
    floor: null,
    edition: '2022',
    inputs: { totalDemandGpm: 1500, requiredHeadBar: 10, hasStandbyDieselPump: false, hasJockeyPump: true },
  });
  assert.equal(pumpBad.complianceStatus, 'NON_COMPLIANT');

  const tankOk = getSystemPlugin('TANK_NFPA22')!.evaluate({
    building: b,
    floor: null,
    edition: '2022',
    inputs: { totalDemandGpm: 400, durationMin: 60, refillRateLpm: 500, hasLevelAlarmAndVortex: true },
  });
  // 400 * 3.78541 * 60 * 1.1 = 99,935 L <= 120,000 L existing tank
  assert.equal(tankOk.complianceStatus, 'COMPLIANT');
  assert.ok(getSystemPlugin('PUMP_TANK_NFPA20_22'), 'Expected backwards compatibility alias for PUMP_TANK_NFPA20_22');
  console.log('✓ Test 7 Passed: Unified 8-system registry & all 6 independent plugins (14, 11, 2001, 72, 20, 22) verified.');
}

// 8. Test Space-Aware Placement for Partitioned Rooms
{
  const b = makeBaseBuilding();
  const f = makeBaseFloor({
    lengthM: 20,
    widthM: 10,
    areaSqm: 200,
    spaces: [
      {
        id: 'room-a',
        name: 'اتاق بایگانی',
        occupancyType: 'ADMINISTRATIVE',
        areaSqm: 50,
        xM: 0,
        yM: 0,
        widthM: 5,
        heightM: 10,
        hazardClasses: ['A'],
        hasFalseCeiling: false,
        hasCriticalElectronics: false,
        sprinklerProtected: true,
      },
    ],
  });
  const res = runNfpaFloorCalculation({ building: b, floor: f });
  const hasExtInRoom = res.suggestedItems.some(
    (it) => it.kind === 'EXTINGUISHER_PROPOSED' && it.xM <= 5 && it.yM <= 10
  );
  assert.ok(hasExtInRoom, 'Expected space-aware placement to place extinguisher inside partitioned room');
  console.log('✓ Test 8 Passed: Space-aware placement for partitioned rooms verified.');
}

// 9. Test Strict Separation of Design Progress % vs Standard Compliance %
{
  const b = makeBaseBuilding();
  const f = makeBaseFloor();
  const sum = computeBuildingDesignSummary({
    building: b,
    floors: [f],
    layouts: [],
    systems: [
      {
        id: 1,
        buildingId: b.id,
        floorId: f.id,
        systemType: 'FOAM_NFPA11',
        standardCode: 'NFPA 11',
        standardEdition: '2021',
        designInputs: {},
        calculationOutput: {},
        complianceStatus: 'NON_COMPLIANT',
        designStage: 'PRELIMINARY',
        version: 1,
        isActive: true,
      },
    ],
    gapActions: [],
    existingEquipment: [],
    activeFloor: f,
  });
  assert.equal(sum.perSystem.length, 8);
  assert.notEqual(
    sum.designProgressPercent,
    sum.standardCompliancePercent,
    'Design Progress % and Standard Compliance % must remain strictly separate metrics'
  );
  console.log('✓ Test 9 Passed: Strict separation between Design Progress % and Standard Compliance % verified.');
}

// 10. Test Sanitization & Strict NULL Discipline for FIRE_NETWORK vs STORAGE_TANK
{
  const netCleaned = sanitizeWaterSupply(
    {
      sourceType: 'FIRE_NETWORK',
      tankCapacityLiters: 150000,
      hasFirePump: false,
      pumpRatedFlowGpm: 750,
      pumpRatedPressureBar: 8.5,
      staticPressureBar: 7.2,
      residualPressureBar: 5.8,
      riserDiameterMm: 100,
      pipeMaterial: 'BLACK_STEEL_WET',
    },
    'FIRE_NETWORK'
  );
  assert.equal(netCleaned.waterSourceType, 'FIRE_NETWORK');
  assert.equal(netCleaned.waterSupply.tankCapacityLiters, null, 'Tank capacity must be null on FIRE_NETWORK');
  assert.equal(netCleaned.waterSupply.pumpRatedFlowGpm, null, 'Pump flow must be null when hasFirePump is false');
  assert.equal(netCleaned.waterSupply.pumpRatedPressureBar, null, 'Pump pressure must be null when hasFirePump is false');
  assert.equal(netCleaned.waterSupply.staticPressureBar, 7.2);
  assert.equal(netCleaned.waterSupply.residualPressureBar, 5.8);

  const tankNoNetCleaned = sanitizeWaterSupply(
    {
      sourceType: 'STORAGE_TANK',
      tankCapacityLiters: 180000,
      hasFirePump: true,
      pumpRatedFlowGpm: 750,
      pumpRatedPressureBar: 8.0,
      hasNetworkConnection: false,
      staticPressureBar: 6.5,
      residualPressureBar: 5.0,
      riserDiameterMm: 125,
    },
    'STORAGE_TANK'
  );
  assert.equal(tankNoNetCleaned.waterSourceType, 'STORAGE_TANK');
  assert.equal(tankNoNetCleaned.waterSupply.tankCapacityLiters, 180000);
  assert.equal(tankNoNetCleaned.waterSupply.staticPressureBar, null, 'Static pressure must be null when !hasNetworkConnection');
  assert.equal(tankNoNetCleaned.waterSupply.residualPressureBar, null, 'Residual pressure must be null when !hasNetworkConnection');
  assert.equal(tankNoNetCleaned.waterSupply.pumpRatedFlowGpm, 750);

  const warnings = getConflictingWaterFieldWarnings(
    { tankCapacityLiters: 150000, pumpRatedFlowGpm: 750 },
    'FIRE_NETWORK',
    false,
    true
  );
  assert.equal(warnings.length, 2, 'Expected warnings for non-applicable tank and pump fields');
  console.log('✓ Test 10 Passed: Water supply sanitization enforces NULL on hidden fields and emits conflict warnings.');
}

// 11. Test FIRE_NETWORK Hydraulic Evaluation (No Tank Required, Direct Pressure vs Booster Pump)
{
  const f = makeBaseFloor();
  const bNetworkSufficient = makeBaseBuilding({
    waterSourceType: 'FIRE_NETWORK',
    waterSupply: {
      sourceType: 'FIRE_NETWORK',
      hasFirePump: false,
      hasNetworkConnection: true,
      tankCapacityLiters: null,
      staticPressureBar: 7.5,
      residualPressureBar: 6.0,
      riserDiameterMm: 100,
      pipeMaterial: 'BLACK_STEEL_WET',
    },
  });
  const resOk = runNfpaFloorCalculation({ building: bNetworkSufficient, floor: f });
  assert.equal(resOk.calculationStatus, 'COMPLETE');
  assert.equal(resOk.sprinkler.hydraulics.sourceTypeUsed, 'FIRE_NETWORK');
  assert.equal(resOk.sprinkler.hydraulics.waterSupplyStatus, 'ADEQUATE');
  assert.equal(resOk.sprinkler.hydraulics.missingWaterFields.length, 0);

  const bNetworkWeakNoPump = makeBaseBuilding({
    waterSourceType: 'FIRE_NETWORK',
    waterSupply: {
      sourceType: 'FIRE_NETWORK',
      hasFirePump: false,
      hasNetworkConnection: true,
      tankCapacityLiters: null,
      staticPressureBar: 2.0,
      residualPressureBar: 1.5,
      riserDiameterMm: 100,
    },
  });
  const resWeak = runNfpaFloorCalculation({ building: bNetworkWeakNoPump, floor: f });
  assert.equal(resWeak.sprinkler.hydraulics.waterSupplyStatus, 'INADEQUATE');

  // Same weak network WITH booster pump becomes ADEQUATE
  const bNetworkWithPump = makeBaseBuilding({
    waterSourceType: 'FIRE_NETWORK',
    waterSupply: {
      sourceType: 'FIRE_NETWORK',
      hasFirePump: true,
      pumpRatedFlowGpm: 600,
      pumpRatedPressureBar: 6.5,
      staticPressureBar: 2.0,
      residualPressureBar: 1.5,
      riserDiameterMm: 100,
    },
  });
  const resBoosted = runNfpaFloorCalculation({ building: bNetworkWithPump, floor: f });
  assert.equal(resBoosted.sprinkler.hydraulics.waterSupplyStatus, 'ADEQUATE');

  // TANK_NFPA22 plugin should not demand missing tank on FIRE_NETWORK building
  const tankPluginOnNet = getSystemPlugin('TANK_NFPA22')!.evaluate({
    building: bNetworkSufficient,
    floor: null,
    edition: '2022',
    inputs: { totalDemandGpm: 400, durationMin: 60, refillRateLpm: 500, hasLevelAlarmAndVortex: true },
  });
  assert.equal(tankPluginOnNet.complianceStatus, 'COMPLIANT');
  assert.equal(tankPluginOnNet.missingFields.length, 0);
  console.log('✓ Test 11 Passed: FIRE_NETWORK evaluation works without tank volume & respects booster pump.');
}

// 12. Test STORAGE_TANK Without Pump + Concurrent Demand & Supply Duration Impact
{
  const f = makeBaseFloor();
  const bTankNoPumpNoNet = makeBaseBuilding({
    waterSourceType: 'STORAGE_TANK',
    waterSupply: {
      sourceType: 'STORAGE_TANK',
      tankCapacityLiters: 200000,
      hasFirePump: false,
      hasNetworkConnection: false,
      staticPressureBar: null,
      riserDiameterMm: 100,
    },
  });
  const resNoPump = runNfpaFloorCalculation({ building: bTankNoPumpNoNet, floor: f });
  assert.equal(resNoPump.sprinkler.hydraulics.waterSupplyStatus, 'INADEQUATE');

  const bTankCustomDuration = makeBaseBuilding({
    waterSourceType: 'STORAGE_TANK',
    waterSupply: {
      sourceType: 'STORAGE_TANK',
      tankCapacityLiters: 120000,
      hasFirePump: true,
      pumpRatedFlowGpm: 900,
      pumpRatedPressureBar: 8.5,
      hasNetworkConnection: false,
      riserDiameterMm: 100,
      hoseStreamAllowanceGpm: 500,
      supplyDurationMin: 90,
    },
  });
  const resLongDuration = runNfpaFloorCalculation({ building: bTankCustomDuration, floor: f });
  // (172 + 500) * 3.78541 * 90 >> 120,000 L -> INADEQUATE
  assert.equal(resLongDuration.sprinkler.hydraulics.waterSupplyStatus, 'INADEQUATE');
  assert.equal(resLongDuration.sprinkler.hydraulics.hoseStreamAllowanceGpm, 500);
  assert.equal(resLongDuration.sprinkler.hydraulics.supplyDurationMin, 90);
  console.log('✓ Test 12 Passed: STORAGE_TANK without pump, custom supply duration & concurrent hose demand verified.');
}

// 13. Test Legacy Record Backward Compatibility (no waterSourceType field)
{
  const legacyTank = makeBaseBuilding({ waterSourceType: undefined, waterSupply: { tankCapacityLiters: 150000 } });
  const legacyNet = makeBaseBuilding({ waterSourceType: undefined, waterSupply: { staticPressureBar: 6.5 } });
  assert.equal(resolveWaterSourceType(legacyTank), 'STORAGE_TANK');
  assert.equal(resolveWaterSourceType(legacyNet), 'FIRE_NETWORK');
  console.log('✓ Test 13 Passed: Legacy building water source inference preserves backward compatibility.');
}

// 14. Regression Test: Multi-Class A+B Building Must Deduplicate ABC_DRY_POWDER Keys
{
  const bMulti = makeBaseBuilding({
    occupancyType: 'WORKSHOP',
    hazardNature: ['A', 'B'],
    storedMaterials: 'مواد بسته‌بندی چوبی و حلال‌های سبک',
  });
  const f = makeBaseFloor();
  const res = runNfpaFloorCalculation({ building: bMulti, floor: f });
  const agentKeys = res.extinguisher.allocationByAgent.map((a) => a.agent);
  const compKeys = res.comparisonRows.map((r) => r.categoryKey);
  assert.equal(new Set(agentKeys).size, agentKeys.length, 'allocationByAgent must have unique agent keys');
  assert.equal(new Set(compKeys).size, compKeys.length, 'comparisonRows must have unique categoryKey values');
  console.log('✓ Test 14 Passed: Multi-class A+B occupancy deduplicates ABC_DRY_POWDER & comparisonRows keys.');
}

console.log('\nALL 14 FIRE DESIGN ENGINE & WORKSPACE TESTS PASSED SUCCESSFULLY!');


