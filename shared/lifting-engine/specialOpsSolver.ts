import {
  EngineeringCheckItem,
  LiftingTurningInput,
  LiftingTurningResult,
  TandemLiftInput,
  TandemLiftResult,
  TurningPhasePoint,
  VerificationStatus,
} from './types.ts';
import { makeStandardRef } from './standardsCatalog.ts';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Tandem Lift (Multi-Crane) load distribution solver with CoG uncertainty shift
 * and out-of-level lateral load transfer + ASME P30.1 capacity derating (default 75%).
 */
export function evaluateTandemLift(
  input: TandemLiftInput,
  standardsOverrides?: Record<string, { edition?: string; factors?: Record<string, any> }>
): TandemLiftResult {
  if (!input.enabled) {
    return {
      status: 'NOT_VERIFIED',
      crane1NominalLoadTon: 0,
      crane2NominalLoadTon: 0,
      crane1WorstCaseLoadTon: 0,
      crane2WorstCaseLoadTon: 0,
      crane1UtilizationPct: null,
      crane2UtilizationPct: null,
      checks: [],
      blockers: ['محاسبات Tandem Lift فعال نشده است.'],
      warnings: [],
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];
  const d1 = Math.max(0.1, input.crane1DistanceFromCogM);
  const d2 = Math.max(0.1, input.crane2DistanceFromCogM);
  const span = d1 + d2;
  const totalFactored = (input.grossLoadTon + (input.equalizerBeamWeightTon || 0)) * Math.max(1, input.dynamicFactor || 1.1);

  const p30Factors = standardsOverrides?.ASME_P30_1?.factors || {};
  const derateMaxPct = input.tandemDeratingFactorPct ?? Number(p30Factors.tandemMaxCraneUtilizationPct || 75);

  const nom1 = round2(totalFactored * (d2 / span));
  const nom2 = round2(totalFactored * (d1 / span));

  // CoG shift tolerance +/- cogUncertaintyM + out-of-level load shift factor (ASME P30.1)
  const shiftM = Math.max(0, input.cogUncertaintyM || 0);
  const levelRad = (Math.max(0, input.outOfLevelDeg || 0) * Math.PI) / 180;
  const levelShiftFrac = Math.min(0.15, Math.sin(levelRad) * 1.5);

  const wc1 = round2(
    totalFactored * Math.min(0.95, (d2 + shiftM) / span + levelShiftFrac)
  );
  const wc2 = round2(
    totalFactored * Math.min(0.95, (d1 + shiftM) / span + levelShiftFrac)
  );

  const u1 = input.crane1RatedCapacityTon && input.crane1RatedCapacityTon > 0
    ? round2((wc1 / input.crane1RatedCapacityTon) * 100)
    : null;
  const u2 = input.crane2RatedCapacityTon && input.crane2RatedCapacityTon > 0
    ? round2((wc2 / input.crane2RatedCapacityTon) * 100)
    : null;

  const stdRef = makeStandardRef(
    'ASME_P30_1',
    'Sec. 2-3.4 (Tandem / Multi-Crane Lifting)',
    'کنترل تقسیم بار دو جرثقیل با احتساب عدم قطعیت CoG و محدودیت بهره‌برداری حداکثر ۷۵٪ ظرفیت جدول',
    standardsOverrides
  );

  const checks: EngineeringCheckItem[] = [];
  const s1: VerificationStatus = u1 === null ? 'NOT_VERIFIED' : u1 > derateMaxPct ? 'FAIL' : u1 > derateMaxPct - 10 ? 'WARNING' : 'PASS';
  const s2: VerificationStatus = u2 === null ? 'NOT_VERIFIED' : u2 > derateMaxPct ? 'FAIL' : u2 > derateMaxPct - 10 ? 'WARNING' : 'PASS';

  if (s1 === 'NOT_VERIFIED') blockers.push('ظرفیت جدول بار جرثقیل اصلی در Tandem Lift مشخص نیست.');
  else if (s1 === 'FAIL') blockers.push(`بهره‌برداری بدترین حالت جرثقیل ۱ (${u1}%) از سقف مجاز Tandem (${derateMaxPct}%) فراتر است.`);

  if (s2 === 'NOT_VERIFIED') blockers.push('ظرفیت جدول بار جرثقیل کمکی (Tail/Crane 2) مشخص نیست.');
  else if (s2 === 'FAIL') blockers.push(`بهره‌برداری بدترین حالت جرثقیل ۲ (${u2}%) از سقف مجاز Tandem (${derateMaxPct}%) فراتر است.`);

  if (input.outOfLevelDeg > 2) {
    warnings.push(`اختلاف تراز / زاویه خروج از شاقول (${input.outOfLevelDeg}°) بالا است؛ همگام‌سازی سرعت بالابری دو جرثقیل الزامی است.`);
  }

  checks.push({
    checkId: 'TANDEM_CRANE_1',
    titleFa: `سهم بار و بهره‌برداری بدترین حالت جرثقیل ۱ (سقف ${derateMaxPct}%)`,
    titleEn: 'Tandem Crane 1 Worst-Case Utilization',
    status: s1,
    actualValue: wc1,
    allowableValue: input.crane1RatedCapacityTon ? round2((input.crane1RatedCapacityTon * derateMaxPct) / 100) : null,
    unit: 'ton',
    utilizationPct: u1,
    formulaText: `F1_wc = W_des × ((d2 + ΔCoG)/(d1+d2) + Δlevel) = ${wc1}t (Nominal=${nom1}t, Rated=${input.crane1RatedCapacityTon ?? 'N/A'}t)`,
    standardRef: stdRef,
  });

  checks.push({
    checkId: 'TANDEM_CRANE_2',
    titleFa: `سهم بار و بهره‌برداری بدترین حالت جرثقیل ۲ (سقف ${derateMaxPct}%)`,
    titleEn: 'Tandem Crane 2 Worst-Case Utilization',
    status: s2,
    actualValue: wc2,
    allowableValue: input.crane2RatedCapacityTon ? round2((input.crane2RatedCapacityTon * derateMaxPct) / 100) : null,
    unit: 'ton',
    utilizationPct: u2,
    formulaText: `F2_wc = W_des × ((d1 + ΔCoG)/(d1+d2) + Δlevel) = ${wc2}t (Nominal=${nom2}t, Rated=${input.crane2RatedCapacityTon ?? 'N/A'}t)`,
    standardRef: stdRef,
  });

  let status: VerificationStatus = 'PASS';
  if (checks.some((c) => c.status === 'FAIL')) status = 'FAIL';
  else if (checks.some((c) => c.status === 'NOT_VERIFIED')) status = 'NOT_VERIFIED';
  else if (checks.some((c) => c.status === 'WARNING') || warnings.length > 0) status = 'WARNING';

  return {
    status,
    crane1NominalLoadTon: nom1,
    crane2NominalLoadTon: nom2,
    crane1WorstCaseLoadTon: wc1,
    crane2WorstCaseLoadTon: wc2,
    crane1UtilizationPct: u1,
    crane2UtilizationPct: u2,
    checks,
    blockers,
    warnings,
  };
}

/**
 * Lifting & Turning (Horizontal-to-Vertical Upending / Tailing) 0° to 90° step equilibrium solver.
 * Tracks main & tail hook loads across all tilt angles θ ∈ [0°, 90°].
 */
export function evaluateLiftingAndTurning(
  input: LiftingTurningInput,
  standardsOverrides?: Record<string, { edition?: string; factors?: Record<string, any> }>
): LiftingTurningResult {
  if (!input.enabled) {
    return {
      status: 'NOT_VERIFIED',
      maxMainCraneLoadTon: 0,
      maxTailCraneLoadTon: 0,
      criticalAngleForMainDeg: 0,
      criticalAngleForTailDeg: 0,
      phases: [],
      checks: [],
      blockers: ['تحلیل فازهای Lifting & Turning فعال نشده است.'],
      warnings: [],
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (
    input.totalWeightTon <= 0 ||
    input.mainLugFromBottomM <= input.tailLugFromBottomM ||
    input.cogFromBottomM < input.tailLugFromBottomM ||
    input.cogFromBottomM > input.mainLugFromBottomM
  ) {
    return {
      status: 'NOT_VERIFIED',
      maxMainCraneLoadTon: 0,
      maxTailCraneLoadTon: 0,
      criticalAngleForMainDeg: 0,
      criticalAngleForTailDeg: 0,
      phases: [],
      checks: [],
      blockers: ['فواصل CoG و نقاط اتصال اصلی/دم (Main/Tail) در تحلیل Lifting & Turning معتبر نیست.'],
      warnings: [],
    };
  }

  const daf = Math.max(1.0, input.dynamicFactor || 1.1);
  const wDesign = input.totalWeightTon * daf;
  const rOff = input.radialOffsetM || 0;

  const phases: TurningPhasePoint[] = [];
  let maxMain = 0;
  let maxTail = 0;
  let critMainDeg = 0;
  let critTailDeg = 0;

  // Evaluate 0° to 90° in 15° steps
  for (let angleDeg = 0; angleDeg <= 90; angleDeg += 15) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    // Horizontal projections relative to tail lug pivot:
    // For radial offset rOff on top side: x(s) = s*cos(theta) - r*sin(theta)
    const xTail = 0;
    const xCog = (input.cogFromBottomM - input.tailLugFromBottomM) * cosA;
    const xMain = Math.max(0.05, (input.mainLugFromBottomM - input.tailLugFromBottomM) * cosA + rOff * sinA);

    let mainLoad: number;
    let tailLoad: number;
    if (angleDeg >= 88) {
      mainLoad = wDesign;
      tailLoad = 0;
    } else {
      // Moment balance around tail hinge: MainLoad * xMain = W * xCog
      const ratio = Math.max(0, Math.min(1, (xCog - xTail) / xMain));
      mainLoad = wDesign * ratio;
      tailLoad = Math.max(0, wDesign - mainLoad);
    }

    mainLoad = round2(mainLoad);
    tailLoad = round2(tailLoad);

    if (mainLoad > maxMain) {
      maxMain = mainLoad;
      critMainDeg = angleDeg;
    }
    if (tailLoad > maxTail) {
      maxTail = tailLoad;
      critTailDeg = angleDeg;
    }

    let phaseStatus: VerificationStatus = 'PASS';
    if (input.mainCraneCapacityTon && mainLoad > input.mainCraneCapacityTon * 0.75) {
      phaseStatus = mainLoad > input.mainCraneCapacityTon ? 'FAIL' : 'WARNING';
    }
    if (input.tailCraneCapacityTon && tailLoad > input.tailCraneCapacityTon * 0.75) {
      if (tailLoad > input.tailCraneCapacityTon) phaseStatus = 'FAIL';
      else if (phaseStatus === 'PASS') phaseStatus = 'WARNING';
    }

    phases.push({
      tiltAngleDeg: angleDeg,
      mainCraneLoadTon: mainLoad,
      tailCraneLoadTon: tailLoad,
      mainCraneSharePct: round2((mainLoad / wDesign) * 100),
      tailCraneSharePct: round2((tailLoad / wDesign) * 100),
      cogHorizontalFromTailM: round2(xCog),
      mainSlingAngleFromVerticalDeg: round2(angleDeg < 88 ? Math.min(8, (90 - angleDeg) * 0.08) : 0),
      status: phaseStatus,
    });
  }

  const stdRef = makeStandardRef(
    'ASME_P30_1',
    'Sec. 2-3.4 & Lifting/Upending Phase Analysis',
    'تحلیل تغییر مرکز ثقل و توزیع بار بین جرثقیل اصلی و کمکی (Tailing Crane) از زاویه ۰° تا ۹۰°',
    standardsOverrides
  );

  const mainUtil = input.mainCraneCapacityTon && input.mainCraneCapacityTon > 0
    ? round2((maxMain / input.mainCraneCapacityTon) * 100)
    : null;
  const tailUtil = input.tailCraneCapacityTon && input.tailCraneCapacityTon > 0
    ? round2((maxTail / input.tailCraneCapacityTon) * 100)
    : null;

  const mainCheckStatus: VerificationStatus =
    mainUtil === null ? 'WARNING' : mainUtil > 85 ? 'FAIL' : mainUtil > 75 ? 'WARNING' : 'PASS';
  const tailCheckStatus: VerificationStatus =
    tailUtil === null ? 'WARNING' : tailUtil > 85 ? 'FAIL' : tailUtil > 75 ? 'WARNING' : 'PASS';

  if (mainCheckStatus === 'FAIL') {
    blockers.push(`حداکثر بار جرثقیل اصلی در فاز برپاسازی (${maxMain} تن در زاویه ${critMainDeg}°) از حد مجاز فراتر است.`);
  }
  if (tailCheckStatus === 'FAIL') {
    blockers.push(`حداکثر بار جرثقیل کمکی/دم (${maxTail} تن در زاویه ${critTailDeg}°) از حد مجاز فراتر است.`);
  }
  if (mainUtil === null || tailUtil === null) {
    warnings.push('ظرفیت کامل هر دو جرثقیل (اصلی و کمکی) برای مقایسه مستقیم در تمام فازهای ۰°–۹۰° تعیین نشده است.');
  }

  const checks: EngineeringCheckItem[] = [
    {
      checkId: 'TURNING_MAIN_PEAK',
      titleFa: 'حداکثر نیروی قلاب جرثقیل اصلی در چرخش ۰° تا ۹۰°',
      titleEn: 'Peak Main Crane Load During Upending',
      status: mainCheckStatus,
      actualValue: maxMain,
      allowableValue: input.mainCraneCapacityTon ?? null,
      unit: 'ton',
      utilizationPct: mainUtil,
      formulaText: `F_main,max = ${maxMain}t @ θ=${critMainDeg}° (W_des = ${round2(wDesign)}t)`,
      standardRef: stdRef,
    },
    {
      checkId: 'TURNING_TAIL_PEAK',
      titleFa: 'حداکثر نیروی قلاب جرثقیل کمکی (Tail Crane) در ۰° تا ۹۰°',
      titleEn: 'Peak Tailing Crane Load During Upending',
      status: tailCheckStatus,
      actualValue: maxTail,
      allowableValue: input.tailCraneCapacityTon ?? null,
      unit: 'ton',
      utilizationPct: tailUtil,
      formulaText: `F_tail,max = ${maxTail}t @ θ=${critTailDeg}°`,
      standardRef: stdRef,
    },
  ];

  let status: VerificationStatus = 'PASS';
  if (checks.some((c) => c.status === 'FAIL') || blockers.length > 0) status = 'FAIL';
  else if (checks.some((c) => c.status === 'NOT_VERIFIED')) status = 'NOT_VERIFIED';
  else if (checks.some((c) => c.status === 'WARNING') || warnings.length > 0) status = 'WARNING';

  return {
    status,
    maxMainCraneLoadTon: maxMain,
    maxTailCraneLoadTon: maxTail,
    criticalAngleForMainDeg: critMainDeg,
    criticalAngleForTailDeg: critTailDeg,
    phases,
    checks,
    blockers,
    warnings,
  };
}
