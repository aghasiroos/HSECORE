import {
  EngineeringCheckItem,
  FullLiftingEvaluationInput,
  FullLiftingEvaluationResult,
  ParameterTraceItem,
  StandardReference,
  VerificationStatus,
} from './types.ts';
import { evaluateCraneLoadChart } from './loadChartSolver.ts';
import { evaluateRiggingAndLoadCases } from './riggingSolver.ts';
import { evaluateLiftingAndTurning, evaluateTandemLift } from './specialOpsSolver.ts';
import { makeStandardRef } from './standardsCatalog.ts';
import {
  DEFAULT_UNIT_PREFERENCES,
  LiftingUnitPreferences,
  roundDisplay,
  toKpa,
  toMeters,
  toMetersPerSec,
  toMetricTon,
} from './unitConverter.ts';

export const LIFTING_ENGINE_VERSION = '2.2.0-static-eq';

export * from './types.ts';
export * from './unitConverter.ts';
export * from './standardsCatalog.ts';
export * from './loadChartSolver.ts';
export * from './staticEquilibriumSolver.ts';
export * from './sensitivityAnalyzer.ts';
export * from './riggingSolver.ts';
export * from './specialOpsSolver.ts';

/**
 * Combines 5-state verification statuses:
 * PASS | FAIL | WARNING | NOT_VERIFIED | NOT_APPLICABLE
 * NOT_APPLICABLE items never poison active checks; if no applicable checks exist, returns NOT_VERIFIED.
 */
export function combineStatuses(statuses: VerificationStatus[]): VerificationStatus {
  const applicable = statuses.filter((s) => s !== 'NOT_APPLICABLE');
  if (applicable.length === 0) return 'NOT_VERIFIED';
  if (applicable.includes('FAIL')) return 'FAIL';
  if (applicable.includes('NOT_VERIFIED')) return 'NOT_VERIFIED';
  if (applicable.includes('WARNING')) return 'WARNING';
  return 'PASS';
}

export function evaluateFullLiftingPlan(rawInput: FullLiftingEvaluationInput): FullLiftingEvaluationResult {
  const prefs: LiftingUnitPreferences = {
    massUnit: rawInput.unitPreferences?.massUnit || DEFAULT_UNIT_PREFERENCES.massUnit,
    lengthUnit: rawInput.unitPreferences?.lengthUnit || DEFAULT_UNIT_PREFERENCES.lengthUnit,
    pressureUnit: rawInput.unitPreferences?.pressureUnit || DEFAULT_UNIT_PREFERENCES.pressureUnit,
    windUnit: rawInput.unitPreferences?.windUnit || DEFAULT_UNIT_PREFERENCES.windUnit,
  };

  // Canonical SI normalization at engine boundary (internal math stays purely SI)
  const convertMass = (v?: number | null) =>
    v !== undefined && v !== null ? toMetricTon(v, prefs.massUnit) : undefined;
  const convertLen = (v?: number | null) =>
    v !== undefined && v !== null ? toMeters(v, prefs.lengthUnit) : undefined;

  const input: FullLiftingEvaluationInput = {
    ...rawInput,
    windSpeedMs:
      rawInput.windSpeedMs !== undefined ? toMetersPerSec(rawInput.windSpeedMs, prefs.windUnit) : undefined,
    groundBearingMaxKpa:
      rawInput.groundBearingMaxKpa !== undefined ? toKpa(rawInput.groundBearingMaxKpa, prefs.pressureUnit) : undefined,
    crane: {
      ...rawInput.crane,
      boomLengthM: convertLen(rawInput.crane.boomLengthM) ?? 0,
      radiusM: convertLen(rawInput.crane.radiusM) ?? 0,
      outriggerSpreadM: convertLen(rawInput.crane.outriggerSpreadM),
      craneDeadWeightTon: convertMass(rawInput.crane.craneDeadWeightTon),
      counterweightTon: convertMass(rawInput.crane.counterweightTon),
    },
    rigging: {
      ...rawInput.rigging,
      netLoadWeightTon: convertMass(rawInput.rigging.netLoadWeightTon) ?? 0,
      riggingAccessoryWeightTon: convertMass(rawInput.rigging.riggingAccessoryWeightTon) ?? 0,
      hookBlockWeightTon: convertMass(rawInput.rigging.hookBlockWeightTon) ?? 0,
      spreaderBeamWeightTon: convertMass(rawInput.rigging.spreaderBeamWeightTon),
      auxiliaryWeightTon: convertMass(rawInput.rigging.auxiliaryWeightTon),
      slingWllTon:
        rawInput.rigging.slingWllTon !== undefined && rawInput.rigging.slingWllTon !== null
          ? convertMass(rawInput.rigging.slingWllTon)
          : rawInput.rigging.slingWllTon,
      shackleWllTon:
        rawInput.rigging.shackleWllTon !== undefined && rawInput.rigging.shackleWllTon !== null
          ? convertMass(rawInput.rigging.shackleWllTon)
          : rawInput.rigging.shackleWllTon,
      cogOffset: {
        x: convertLen(rawInput.rigging.cogOffset?.x) ?? 0,
        y: convertLen(rawInput.rigging.cogOffset?.y) ?? 0,
        z: convertLen(rawInput.rigging.cogOffset?.z) ?? 0,
      },
      hookPosition: {
        x: convertLen(rawInput.rigging.hookPosition?.x) ?? 0,
        y: convertLen(rawInput.rigging.hookPosition?.y) ?? 0,
        z: convertLen(rawInput.rigging.hookPosition?.z) ?? 0,
      },
      attachmentPoints: (rawInput.rigging.attachmentPoints || []).map((pt) => ({
        ...pt,
        position: {
          x: convertLen(pt.position.x) ?? 0,
          y: convertLen(pt.position.y) ?? 0,
          z: convertLen(pt.position.z) ?? 0,
        },
        upperPosition: pt.upperPosition
          ? {
              x: convertLen(pt.upperPosition.x) ?? 0,
              y: convertLen(pt.upperPosition.y) ?? 0,
              z: convertLen(pt.upperPosition.z) ?? 0,
            }
          : undefined,
        customWllTon:
          pt.customWllTon !== undefined && pt.customWllTon !== null ? convertMass(pt.customWllTon) : undefined,
      })),
      weightComponents: Array.isArray(rawInput.rigging.weightComponents)
        ? rawInput.rigging.weightComponents.map((wc) => ({
            ...wc,
            weightTon: convertMass(wc.weightTon) ?? 0,
            cogPosition: wc.cogPosition
              ? {
                  x: convertLen(wc.cogPosition.x) ?? 0,
                  y: convertLen(wc.cogPosition.y) ?? 0,
                  z: convertLen(wc.cogPosition.z) ?? 0,
                }
              : undefined,
          }))
        : undefined,
      sensitivityUncertainties: rawInput.rigging.sensitivityUncertainties
        ? {
            ...rawInput.rigging.sensitivityUncertainties,
            cogShiftM:
              rawInput.rigging.sensitivityUncertainties.cogShiftM !== undefined
                ? convertLen(rawInput.rigging.sensitivityUncertainties.cogShiftM)
                : undefined,
            hookHeightDeltaM:
              rawInput.rigging.sensitivityUncertainties.hookHeightDeltaM !== undefined
                ? convertLen(rawInput.rigging.sensitivityUncertainties.hookHeightDeltaM)
                : undefined,
          }
        : undefined,
    },
  };

  const allBlockers: string[] = [];
  const allWarnings: string[] = [];
  const allChecks: EngineeringCheckItem[] = [];
  const parameterTrace: ParameterTraceItem[] = [];

  const verifiedGates = new Set(input.verifiedGates || ['G1', 'G2']);
  const coreVerified = verifiedGates.has('G2');
  const advancedVerified = verifiedGates.has('G4');

  const moduleTiers: Record<string, 'VERIFIED_CORE' | 'EXPERIMENTAL_UNVERIFIED'> = {
    CORE_RIGGING_EQ: coreVerified ? 'VERIFIED_CORE' : 'EXPERIMENTAL_UNVERIFIED',
    CRANE_LOAD_CHART: coreVerified ? 'VERIFIED_CORE' : 'EXPERIMENTAL_UNVERIFIED',
    TANDEM_LIFT: advancedVerified ? 'VERIFIED_CORE' : 'EXPERIMENTAL_UNVERIFIED',
    LIFT_AND_TURN: advancedVerified ? 'VERIFIED_CORE' : 'EXPERIMENTAL_UNVERIFIED',
  };

  // 1. Solve Rigging & Gross Load first (to know actual hook load)
  const riggingPre = evaluateRiggingAndLoadCases(input.rigging, null, input.standardsOverrides);

  // 2. Solve Primary Crane Load Chart
  const isTandem = Boolean(input.tandem?.enabled || input.liftCategory === 'TANDEM');
  const maxCranePct = isTandem
    ? (input.standardsOverrides?.ASME_P30_1?.factors?.tandemMaxCraneUtilizationPct ?? 75)
    : (input.standardsOverrides?.ASME_P30_1?.factors?.standardMaxCraneUtilizationPct ?? 85);

  let effectivePrimaryHookLoad = riggingPre.designTotalLoadTon;
  if (input.tandem?.enabled) {
    const tandemPre = evaluateTandemLift(
      {
        ...input.tandem,
        grossLoadTon: riggingPre.grossStaticLoadTon,
        dynamicFactor: input.rigging.dynamicFactor,
      },
      input.standardsOverrides
    );
    effectivePrimaryHookLoad = tandemPre.crane1WorstCaseLoadTon;
  }

  const craneResult = evaluateCraneLoadChart(
    {
      ...input.crane,
      maxAllowableUtilizationPct: input.crane.maxAllowableUtilizationPct ?? Number(maxCranePct),
    },
    effectivePrimaryHookLoad,
    input.standardsOverrides
  );

  // Re-evaluate rigging loadCases with authoritative crane capacity
  const riggingResult = evaluateRiggingAndLoadCases(
    input.rigging,
    craneResult.ratedCapacityTon,
    input.standardsOverrides
  );

  allChecks.push({
    checkId: 'CRANE_LOAD_CHART',
    titleFa: 'ظرفیت جدول بار جرثقیل اصلی و ظرفیت باقی‌مانده',
    titleEn: 'Primary Crane Rated Capacity vs Design Hook Load',
    status: craneResult.status,
    actualValue: roundDisplay(effectivePrimaryHookLoad, 3),
    allowableValue: craneResult.ratedCapacityTon,
    remainingCapacity: craneResult.remainingCapacityTon,
    unit: 'ton',
    utilizationPct: craneResult.utilizationPct,
    formulaText: craneResult.formulaText,
    standardRef: craneResult.standardRef,
  });

  parameterTrace.push({
    key: 'CRANE_LOAD_CHART',
    nameFa: 'ظرفیت جدول بار جرثقیل و ظرفیت باقی‌مانده',
    inputValue: `Boom=${input.crane.boomLengthM}m, R=${input.crane.radiusM}m, Cfg=${input.crane.outriggerConfig}`,
    computedValue:
      craneResult.ratedCapacityTon !== null
        ? `${craneResult.ratedCapacityTon}t (Util=${craneResult.utilizationPct}%, Rem=${craneResult.remainingCapacityTon}t)`
        : null,
    unit: 'ton',
    formula: craneResult.formulaText,
    standardRef: `${craneResult.standardRef.standardCode} ${craneResult.standardRef.clause}`,
    factors: `Max Allowable Utilization = ${input.crane.maxAllowableUtilizationPct ?? maxCranePct}%`,
    assumptions: [`Lookup Method: ${craneResult.lookupMethod}`],
    validationStatus: craneResult.status,
    finalStatus: craneResult.status,
  });

  allChecks.push(...riggingResult.checks);
  parameterTrace.push(...riggingResult.parameterTrace);
  allBlockers.push(...craneResult.blockers, ...riggingResult.blockers);
  allWarnings.push(...craneResult.warnings, ...riggingResult.warnings);

  // 3. Environmental Wind Check
  const maxWindLimitMs = Number(input.standardsOverrides?.ASME_P30_1?.factors?.minWindSpeedLimitMs || 13.8);
  if (input.windSpeedMs !== undefined && Number.isFinite(input.windSpeedMs) && input.windSpeedMs > 0) {
    const windStatus: VerificationStatus =
      input.windSpeedMs > maxWindLimitMs ? 'FAIL' : input.windSpeedMs > maxWindLimitMs * 0.8 ? 'WARNING' : 'PASS';
    if (windStatus === 'FAIL') {
      allBlockers.push(`سرعت باد طراحی/محیط (${roundDisplay(input.windSpeedMs, 2)} m/s) بیش از حد مجاز عملیات (${maxWindLimitMs} m/s) است.`);
    }
    const windRef = makeStandardRef('ASME_B30_5', 'Sec. 5-3.2', 'محدودیت سرعت باد مجاز در عملیات جرثقیل', input.standardsOverrides);
    allChecks.push({
      checkId: 'WIND_LIMIT',
      titleFa: 'کنترل حد مجاز سرعت باد عملیات باربرداری',
      titleEn: 'Operating Wind Speed Limit',
      status: windStatus,
      actualValue: roundDisplay(input.windSpeedMs, 2),
      allowableValue: maxWindLimitMs,
      remainingCapacity: roundDisplay(maxWindLimitMs - input.windSpeedMs, 2),
      unit: 'm/s',
      utilizationPct: roundDisplay((input.windSpeedMs / maxWindLimitMs) * 100, 2),
      formulaText: `V_wind = ${roundDisplay(input.windSpeedMs, 2)} m/s vs Limit = ${maxWindLimitMs} m/s`,
      standardRef: windRef,
    });
    parameterTrace.push({
      key: 'WIND_LIMIT',
      nameFa: 'سرعت باد محیط عملیات',
      inputValue: rawInput.windSpeedMs ?? null,
      computedValue: roundDisplay(input.windSpeedMs, 2),
      unit: 'm/s',
      formula: 'V_wind ≤ V_limit (OEM / ASME B30.5)',
      standardRef: `${windRef.standardCode} ${windRef.clause}`,
      factors: `Warning ≥ 80% Limit (${roundDisplay(maxWindLimitMs * 0.8, 2)} m/s)`,
      assumptions: [`واحد ورودی: ${prefs.windUnit}`],
      validationStatus: windStatus,
      finalStatus: windStatus,
    });
  } else {
    parameterTrace.push({
      key: 'WIND_LIMIT',
      nameFa: 'سرعت باد محیط عملیات',
      inputValue: null,
      computedValue: null,
      unit: 'm/s',
      formula: 'V_wind ≤ V_limit',
      standardRef: 'ASME B30.5 Sec. 5-3.2',
      factors: `Max = ${maxWindLimitMs} m/s`,
      assumptions: ['سرعت باد برای کنترل میدانی پیش از اجرا باید ثبت شود.'],
      validationStatus: 'NOT_APPLICABLE',
      finalStatus: 'NOT_APPLICABLE',
    });
  }

  // 4. Ground Bearing Pressure Check
  const gbRef = makeStandardRef('ASME_B30_5', 'Sec. 5-3.2 / Outrigger Support', 'کنترل مقاومت بستر و زیرجکی جک‌ها', input.standardsOverrides);
  if (craneResult.groundBearingPressureKpa !== null && input.groundBearingMaxKpa && input.groundBearingMaxKpa > 0) {
    const gbUtil = roundDisplay((craneResult.groundBearingPressureKpa / input.groundBearingMaxKpa) * 100, 2);
    let gbStatus: VerificationStatus = gbUtil > 100 ? 'FAIL' : gbUtil > 85 ? 'WARNING' : 'PASS';
    if (gbStatus === 'FAIL') {
      allBlockers.push(`فشار تکیه‌گاهی جک‌ها (${craneResult.groundBearingPressureKpa} kPa) بیش از ظرفیت باربری خاک (${roundDisplay(input.groundBearingMaxKpa, 1)} kPa) است.`);
    } else if (!craneResult.groundBearingVerified && gbStatus === 'PASS') {
      // Honest safety guard: never assign green PASS when crane dead weight / pad area is estimated
      gbStatus = 'WARNING';
      if (craneResult.bearingAssumptionNote) {
        allWarnings.push(craneResult.bearingAssumptionNote);
      }
    }
    allChecks.push({
      checkId: 'GROUND_BEARING',
      titleFa: 'کنترل فشار تکیه‌گاهی جک جرثقیل بر بستر زمین (Ground Bearing)',
      titleEn: 'Outrigger Ground Bearing Pressure',
      status: gbStatus,
      actualValue: craneResult.groundBearingPressureKpa,
      allowableValue: roundDisplay(input.groundBearingMaxKpa, 2),
      remainingCapacity: roundDisplay(input.groundBearingMaxKpa - craneResult.groundBearingPressureKpa, 2),
      unit: 'kPa',
      utilizationPct: gbUtil,
      formulaText: `P_ground = R_max / A_pad = ${craneResult.groundBearingPressureKpa} kPa vs Soil Allowable = ${roundDisplay(input.groundBearingMaxKpa, 2)} kPa`,
      standardRef: gbRef,
    });
    parameterTrace.push({
      key: 'GROUND_BEARING',
      nameFa: 'فشار تکیه‌گاهی جک بر بستر خاک',
      inputValue: `SoilAllow=${roundDisplay(input.groundBearingMaxKpa, 2)} kPa, PadArea=${input.crane.outriggerPadAreaM2 ?? 'Est 1.0'} m²`,
      computedValue: craneResult.groundBearingPressureKpa,
      unit: 'kPa',
      formula: 'P_ground = (R_max × 9.80665) / A_pad',
      standardRef: `${gbRef.standardCode} ${gbRef.clause}`,
      factors: craneResult.groundBearingVerified ? 'داده واقعی جرثقیل و زیرجکی' : 'تخمین مرجع (نیازمند ورود مساحت پد و وزن جرثقیل)',
      assumptions: [craneResult.bearingAssumptionNote || ''],
      validationStatus: gbStatus,
      finalStatus: gbStatus,
    });
  } else if (['CRAWLER_360', 'ON_TIRES', 'PICK_AND_CARRY'].includes(String(input.crane.outriggerConfig || '').toUpperCase())) {
    allChecks.push({
      checkId: 'GROUND_BEARING',
      titleFa: 'کنترل فشار جک جرثقیل (Outrigger Bearing)',
      titleEn: 'Outrigger Ground Bearing Pressure',
      status: 'NOT_APPLICABLE',
      actualValue: null,
      allowableValue: null,
      unit: 'kPa',
      utilizationPct: null,
      formulaText: 'برای پیکربندی بدون جک (Crawler / On Tires) صدق نمی‌کند (NOT_APPLICABLE).',
      standardRef: gbRef,
    });
  }

  // 5. Optional Tail Crane + Tandem Lift
  let tailCraneResult;
  let tandemResult;
  if (input.tailCrane) {
    const tailHookLoad = input.tandem?.enabled ? 0 : riggingResult.designTotalLoadTon * 0.5;
    tailCraneResult = evaluateCraneLoadChart(
      {
        ...input.tailCrane,
        maxAllowableUtilizationPct: Number(maxCranePct),
      },
      tailHookLoad,
      input.standardsOverrides
    );
  }

  if (input.tandem?.enabled) {
    tandemResult = evaluateTandemLift(
      {
        ...input.tandem,
        grossLoadTon: riggingResult.grossStaticLoadTon,
        dynamicFactor: input.rigging.dynamicFactor,
        crane1RatedCapacityTon: craneResult.ratedCapacityTon ?? input.tandem.crane1RatedCapacityTon,
        crane2RatedCapacityTon: tailCraneResult?.ratedCapacityTon ?? input.tandem.crane2RatedCapacityTon,
      },
      input.standardsOverrides
    );
    allChecks.push(...tandemResult.checks);
    allBlockers.push(...tandemResult.blockers);
    allWarnings.push(...tandemResult.warnings);
  }

  // 8. Optional Lifting & Turning (0-90 deg)
  let turningResult;
  if (input.turning?.enabled) {
    turningResult = evaluateLiftingAndTurning(
      {
        ...input.turning,
        totalWeightTon: input.turning.totalWeightTon > 0 ? input.turning.totalWeightTon : riggingResult.grossStaticLoadTon,
        mainCraneCapacityTon: craneResult.ratedCapacityTon ?? input.turning.mainCraneCapacityTon,
        tailCraneCapacityTon: tailCraneResult?.ratedCapacityTon ?? input.turning.tailCraneCapacityTon,
      },
      input.standardsOverrides
    );
    allChecks.push(...turningResult.checks);
    allBlockers.push(...turningResult.blockers);
    allWarnings.push(...turningResult.warnings);
  }

  // 9. Blind Lift mandatory checks
  if (input.blindLiftParams?.isBlindLift || input.liftCategory === 'BLIND') {
    const bl = input.blindLiftParams;
    const blindComplete = Boolean(
      bl?.hasDedicatedSignaler &&
      bl?.communicationPrimary?.trim() &&
      bl?.emergencyStopVerified
    );
    allChecks.push({
      checkId: 'BLIND_LIFT_CONTROLS',
      titleFa: 'الزامات کنترل عملیات باربرداری کور (Blind Lift)',
      titleEn: 'Blind Lift Dedicated Signaler & Comms Check',
      status: blindComplete ? 'PASS' : 'FAIL',
      actualValue: blindComplete ? 1 : 0,
      allowableValue: 1,
      unit: 'bool',
      utilizationPct: blindComplete ? 100 : 0,
      formulaText: 'الزام علامت‌دهنده اختصاصی + سیستم ارتباط رادیویی/دوطرفه + دستورالعمل توقف اضطراری',
      standardRef: makeStandardRef('ASME_P30_1', 'Sec. 2-4 (Blind Lift)', 'الزامات ارتباطی و علامت‌دهنده در نقاط کور اپراتور', input.standardsOverrides),
    });
    if (!blindComplete) {
      allBlockers.push('در عملیات Blind Lift تعیین علامت‌دهنده اختصاصی، سیستم ارتباطی و توقف اضطراری الزامی است.');
    }
  }

  // 10. Certificate & Competency flags
  if (input.equipmentCertsValid === false) {
    allBlockers.push('گواهینامه یا بازرسی دوره‌ای جرثقیل / تجهیزات ریگری منقضی یا نامعتبر است.');
    allChecks.push({
      checkId: 'CERT_VALIDITY',
      titleFa: 'اعتبار گواهینامه‌ها و بازرسی تجهیزات',
      titleEn: 'Equipment Certificates & Inspection Validity',
      status: 'FAIL',
      actualValue: 0,
      allowableValue: 1,
      unit: 'valid',
      utilizationPct: 0,
      formulaText: 'تایید اعتبار تاریخ گواهینامه و سلامت تجهیز الزامی است',
      standardRef: makeStandardRef('ASME_B30_5', 'Sec. 5-2.1 / B30.9', 'بازرسی و گواهینامه معتبر تجهیزات', input.standardsOverrides),
    });
  }

  if (input.personnelQualified === false) {
    allBlockers.push('صلاحیت/آموزش معتبر اپراتور، ریگر یا علامت‌دهنده تایید نشده است.');
  }

  const uniqueRefsMap = new Map<string, StandardReference>();
  for (const ch of allChecks) {
    const k = `${ch.standardRef.standardCode}:${ch.standardRef.clause}`;
    if (!uniqueRefsMap.has(k)) uniqueRefsMap.set(k, ch.standardRef);
  }

  const statuses: VerificationStatus[] = allChecks.map((c) => c.status);
  if (allBlockers.length > 0 && !statuses.includes('FAIL') && !statuses.includes('NOT_VERIFIED')) {
    statuses.push('FAIL');
  }

  // Determine validationTier: VERIFIED_CORE only if Gate G2 is verified AND any invoked advanced modules also have verified gate
  const hasUnverifiedAdvancedInvoked =
    (Boolean(input.tandem?.enabled) && moduleTiers.TANDEM_LIFT === 'EXPERIMENTAL_UNVERIFIED') ||
    (Boolean(input.turning?.enabled) && moduleTiers.LIFT_AND_TURN === 'EXPERIMENTAL_UNVERIFIED');

  const validationTier: 'VERIFIED_CORE' | 'EXPERIMENTAL_UNVERIFIED' =
    coreVerified && !hasUnverifiedAdvancedInvoked ? 'VERIFIED_CORE' : 'EXPERIMENTAL_UNVERIFIED';

  return {
    engineVersion: LIFTING_ENGINE_VERSION,
    validationTier,
    moduleTiers,
    unitPreferences: prefs,
    overallStatus: combineStatuses(statuses),
    remainingCraneCapacityTon: craneResult.remainingCapacityTon,
    craneResult,
    tailCraneResult,
    riggingResult,
    tandemResult,
    turningResult,
    standardReferences: Array.from(uniqueRefsMap.values()),
    allChecks,
    parameterTrace,
    blockers: Array.from(new Set(allBlockers)),
    warnings: Array.from(new Set(allWarnings)),
    calculatedAt: new Date().toISOString(),
  };
}
