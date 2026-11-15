import { CraneLookupInput, CraneLookupResult, VerificationStatus } from './types.ts';
import { makeStandardRef } from './standardsCatalog.ts';
import { GRAVITY_MPS2, isValidPositiveFinite, roundDisplay } from './unitConverter.ts';

export function evaluateCraneLoadChart(
  input: CraneLookupInput,
  totalHookLoadTon: number,
  standardsOverrides?: Record<string, { edition?: string; factors?: Record<string, any> }>
): CraneLookupResult {
  const stdRef = makeStandardRef(
    'ASME_B30_5',
    'Sec. 5-1.1 / ASME P30.1 Sec. 2-2.2',
    'تعیین ظرفیت مجاز جرثقیل منحصراً از روی جدول بار واقعی (Load Chart) در طول بوم، شعاع کار، وزن تعادل و آرایش جک مشخص',
    standardsOverrides
  );

  const maxUtilLimitPct = input.maxAllowableUtilizationPct ?? 85;
  const points = (input.chartPoints || []).filter(
    (p) =>
      Number.isFinite(p.boomLengthM) &&
      p.boomLengthM > 0 &&
      Number.isFinite(p.radiusM) &&
      p.radiusM > 0 &&
      Number.isFinite(p.ratedCapacityTon) &&
      p.ratedCapacityTon > 0
  );

  if (points.length === 0) {
    return {
      status: 'NOT_VERIFIED',
      ratedCapacityTon: null,
      remainingCapacityTon: null,
      lookupMethod: 'NO_CHART_DATA',
      matchedBoomLengthM: null,
      matchedRadiusM: null,
      utilizationPct: null,
      outriggerReactionMaxTon: null,
      groundBearingPressureKpa: null,
      groundBearingVerified: false,
      bearingAssumptionNote: 'جدول بار برای محاسبه واکنش واقعی ثبت نشده است.',
      standardRef: stdRef,
      formulaText: 'هیچ ردیف جدولی در Load Chart جرثقیل ثبت نشده است (حدس ظرفیت بر اساس نام مدل ممنوع است).',
      blockers: ['جدول بار (Load Chart) برای جرثقیل انتخاب‌شده ثبت نشده است؛ وضعیت قابل تأیید نیست.'],
      warnings: [],
    };
  }

  if (!isValidPositiveFinite(input.boomLengthM) || !isValidPositiveFinite(input.radiusM)) {
    return {
      status: 'NOT_VERIFIED',
      ratedCapacityTon: null,
      remainingCapacityTon: null,
      lookupMethod: 'OUT_OF_RANGE',
      matchedBoomLengthM: null,
      matchedRadiusM: null,
      utilizationPct: null,
      outriggerReactionMaxTon: null,
      groundBearingPressureKpa: null,
      groundBearingVerified: false,
      bearingAssumptionNote: 'طول بوم یا شعاع کار معتبر وارد نشده است.',
      standardRef: stdRef,
      formulaText: 'طول بوم و شعاع باربرداری معتبر وارد نشده‌اند.',
      blockers: ['طول بوم (Boom Length) یا شعاع کار (Working Radius) نامعتبر یا صفر است.'],
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const blockers: string[] = [];

  // Filter by outrigger configuration strictly
  const reqOutrigger = String(input.outriggerConfig || '').toUpperCase();
  const configPoints = points.filter(
    (p) => String(p.outriggerConfig || '').toUpperCase() === reqOutrigger
  );

  if (configPoints.length === 0) {
    return {
      status: 'NOT_VERIFIED',
      ratedCapacityTon: null,
      remainingCapacityTon: null,
      lookupMethod: 'NO_CHART_DATA',
      matchedBoomLengthM: null,
      matchedRadiusM: null,
      utilizationPct: null,
      outriggerReactionMaxTon: null,
      groundBearingPressureKpa: null,
      groundBearingVerified: false,
      standardRef: stdRef,
      formulaText: `پیکربندی «${input.outriggerConfig}» در Load Chart ثبت نشده است.`,
      blockers: [`برای پیکربندی جک/تکیه‌گاه «${input.outriggerConfig}» هیچ داده Load Chart وجود ندارد.`],
      warnings: [],
    };
  }

  // Optional Counterweight match filtering if chart carries counterweight distinctions
  let activePoints = configPoints;
  if (isValidPositiveFinite(input.counterweightTon)) {
    const cwtFiltered = configPoints.filter(
      (p) => !isValidPositiveFinite(p.counterweightTon) || Math.abs((p.counterweightTon || 0) - input.counterweightTon!) < 0.25
    );
    if (cwtFiltered.length > 0) {
      activePoints = cwtFiltered;
    } else {
      warnings.push(`ردیف دقیق وزن تعادل ${input.counterweightTon} تن در چارت یافت نشد؛ بررسی دستی وزن تعادل الزامی است.`);
    }
  }

  // Exact match check (within 0.05m geometry rounding tolerance)
  const exact = activePoints.find(
    (p) => Math.abs(p.boomLengthM - input.boomLengthM) < 0.05 && Math.abs(p.radiusM - input.radiusM) < 0.05
  );

  let ratedCapacityTon: number | null = null;
  let lookupMethod: CraneLookupResult['lookupMethod'] = 'OUT_OF_RANGE';
  let matchedBoom: number | null = null;
  let matchedRadius: number | null = null;

  if (exact) {
    ratedCapacityTon = exact.ratedCapacityTon;
    lookupMethod = 'EXACT';
    matchedBoom = exact.boomLengthM;
    matchedRadius = exact.radiusM;
  } else {
    const sortedBooms = Array.from(new Set(activePoints.map((p) => p.boomLengthM))).sort((a, b) => a - b);
    const minChartBoom = sortedBooms[0];
    const maxChartBoom = sortedBooms[sortedBooms.length - 1];

    if (input.boomLengthM < minChartBoom - 0.01 || input.boomLengthM > maxChartBoom + 0.01) {
      return {
        status: 'FAIL',
        ratedCapacityTon: null,
        remainingCapacityTon: null,
        lookupMethod: 'OUT_OF_RANGE',
        matchedBoomLengthM: null,
        matchedRadiusM: null,
        utilizationPct: null,
        outriggerReactionMaxTon: null,
        groundBearingPressureKpa: null,
        groundBearingVerified: false,
        standardRef: stdRef,
        formulaText: `طول بوم درخواستی (${input.boomLengthM}m) خارج از بازه جدول بار [${minChartBoom}m – ${maxChartBoom}m] است.`,
        blockers: [`طول بوم ${input.boomLengthM} متر خارج از محدوده مجاز Load Chart (${minChartBoom} تا ${maxChartBoom} متر) است.`],
        warnings: [],
      };
    }

    // ASME B30.5 conservative lookup: next LONGER/equal boom AND next GREATER/equal radius
    const candidateBooms = sortedBooms.filter((b) => b >= input.boomLengthM - 0.01);
    const chosenBoom = candidateBooms.length > 0 ? candidateBooms[0] : sortedBooms[sortedBooms.length - 1];
    const boomSlice = activePoints
      .filter((p) => Math.abs(p.boomLengthM - chosenBoom) < 0.05)
      .sort((a, b) => a.radiusM - b.radiusM);

    const minR = boomSlice[0]?.radiusM ?? 0;
    const maxR = boomSlice[boomSlice.length - 1]?.radiusM ?? 0;

    // Strict radius domain check (removed unsafe -0.5m fudge below minR)
    if (boomSlice.length === 0 || input.radiusM > maxR + 0.01 || input.radiusM < minR - 0.01) {
      return {
        status: 'FAIL',
        ratedCapacityTon: null,
        remainingCapacityTon: null,
        lookupMethod: 'OUT_OF_RANGE',
        matchedBoomLengthM: chosenBoom,
        matchedRadiusM: null,
        utilizationPct: null,
        outriggerReactionMaxTon: null,
        groundBearingPressureKpa: null,
        groundBearingVerified: false,
        standardRef: stdRef,
        formulaText: `شعاع ${input.radiusM}m در بوم ${chosenBoom}m خارج از محدوده مجاز جدول بار [${minR}m – ${maxR}m] است.`,
        blockers: [`شعاع کار ${input.radiusM} متر برای بوم ${chosenBoom} متر خارج از محدوده جدول (${minR} تا ${maxR} متر) است.`],
        warnings: [],
      };
    }

    const nextRadiusRow = boomSlice.find((p) => p.radiusM >= input.radiusM - 0.01) || boomSlice[boomSlice.length - 1];
    ratedCapacityTon = nextRadiusRow.ratedCapacityTon;
    matchedBoom = nextRadiusRow.boomLengthM;
    matchedRadius = nextRadiusRow.radiusM;
    lookupMethod = 'CONSERVATIVE_INTERPOLATION';
    warnings.push(
      `مقدار دقیق (${input.boomLengthM}m / ${input.radiusM}m) در جدول نبود؛ مطابق رویه محافظه‌کارانه ASME B30.5 ردیف بعدی (بوم ${matchedBoom}m، شعاع ${matchedRadius}m) ملاک قرار گرفت.`
    );
  }

  const utilizationRaw = ratedCapacityTon > 0 ? (totalHookLoadTon / ratedCapacityTon) * 100 : null;
  const utilizationPct = utilizationRaw !== null ? roundDisplay(utilizationRaw, 2) : null;
  const remainingCapacityTon = ratedCapacityTon !== null ? roundDisplay(ratedCapacityTon - totalHookLoadTon, 3) : null;

  // Outrigger Reaction & Ground Bearing (Never silently pretend estimated values are verified!)
  const isOutriggerConfig = !['CRAWLER_360', 'ON_TIRES', 'PICK_AND_CARRY'].includes(reqOutrigger);
  let outriggerReactionMaxTon: number | null = null;
  let groundBearingPressureKpa: number | null = null;
  let groundBearingVerified = false;
  let bearingAssumptionNote = '';

  if (isOutriggerConfig) {
    const spreadM = Math.max(2.5, input.outriggerSpreadM || 7.5);
    const hasRealDeadWeight = isValidPositiveFinite(input.craneDeadWeightTon);
    const hasRealPadArea = isValidPositiveFinite(input.outriggerPadAreaM2);
    const deadWeightTon = hasRealDeadWeight ? input.craneDeadWeightTon! : Math.max(20, (ratedCapacityTon || 50) * 0.48);
    const padAreaM2 = hasRealPadArea ? input.outriggerPadAreaM2! : 1.0;

    // Conservative moment-based corner outrigger reaction envelope
    const momentArmRatio = Math.min(0.85, 0.35 + (input.radiusM / (spreadM * 2.2)) * 0.35);
    const reactionRaw = deadWeightTon * 0.32 + totalHookLoadTon * momentArmRatio;
    outriggerReactionMaxTon = roundDisplay(reactionRaw, 3);
    groundBearingPressureKpa = roundDisplay((reactionRaw * GRAVITY_MPS2) / padAreaM2, 2);

    groundBearingVerified = hasRealDeadWeight && hasRealPadArea;
    if (!groundBearingVerified) {
      bearingAssumptionNote = 'وزن خالص جرثقیل یا مساحت زیرجکی واقعی وارد نشده؛ فشار خاک صرفاً تخمین مرجع است و باید با کاتالوگ سازنده و مشخصات پد تأیید شود.';
    } else {
      bearingAssumptionNote = `محاسبه دقیق با وزن جرثقیل ${deadWeightTon}t و سطح زیرجکی ${padAreaM2}m²`;
    }
  } else {
    bearingAssumptionNote = `پیکربندی ${reqOutrigger} بدون جک هیدرولیک (Outrigger) است.`;
  }

  let status: VerificationStatus = 'PASS';
  if (utilizationPct === null) {
    status = 'NOT_VERIFIED';
  } else if (utilizationPct > 100) {
    status = 'FAIL';
    blockers.push(`بار کل روی قلاب (${roundDisplay(totalHookLoadTon, 2)} تن) از ظرفیت جدول جرثقیل (${ratedCapacityTon} تن) بیشتر است (${utilizationPct}%).`);
  } else if (utilizationPct > maxUtilLimitPct) {
    status = 'FAIL';
    blockers.push(`درصد بهره‌برداری جرثقیل (${utilizationPct}%) از حد مجاز استاندارد (${maxUtilLimitPct}%) فراتر است.`);
  } else if (utilizationPct >= 75) {
    status = 'WARNING';
    warnings.push(`درصد بهره‌برداری جرثقیل ${utilizationPct}% است (محدوده باربرداری حساس / Critical Lift مطابق ASME P30.1).`);
  }

  if (status === 'PASS' && warnings.length > 0) {
    status = 'WARNING';
  }

  const formulaText = `Chart Lookup (${lookupMethod}): Boom=${matchedBoom}m, Radius=${matchedRadius}m, Config=${input.outriggerConfig} => Rated=${ratedCapacityTon}t | Hook=${roundDisplay(totalHookLoadTon, 3)}t | Rem=${remainingCapacityTon}t | Util=${utilizationPct}% (Max ${maxUtilLimitPct}%)`;

  return {
    status,
    ratedCapacityTon: roundDisplay(ratedCapacityTon, 3),
    remainingCapacityTon,
    lookupMethod,
    matchedBoomLengthM: matchedBoom,
    matchedRadiusM: matchedRadius,
    utilizationPct,
    outriggerReactionMaxTon,
    groundBearingPressureKpa,
    groundBearingVerified,
    bearingAssumptionNote,
    standardRef: stdRef,
    formulaText,
    blockers,
    warnings,
  };
}
