import {
  RiggingEvaluationInput,
  SensitivityAnalysisReport,
  SensitivityParameterImpact,
} from './types.ts';
import { solveRiggingStaticSystem } from './staticEquilibriumSolver.ts';
import { roundDisplay } from './unitConverter.ts';

/**
 * Deterministic Partial Sensitivity & Uncertainty Engine (§8)
 * Evaluates how variations in load weight, CoG position, sling length tolerances,
 * hook height (sling angle), and axial stiffness affect governing leg tension.
 * Never invents fake statistical randomness when explicit tolerances are absent.
 */
export function runRiggingSensitivityAnalysis(
  input: RiggingEvaluationInput,
  baseLoadAtSlingsTon: number,
  baseCog: { x: number; y: number; z: number },
  baseHookPos: { x: number; y: number; z: number },
  baselineMaxTensionTon: number,
  effectiveSlingWllTon: number | null,
  shackleEffectiveWllTon: number | null
): SensitivityAnalysisReport {
  const unc = input.sensitivityUncertainties;
  const hasUserUncertainties = Boolean(
    unc && (unc.weightPct || unc.cogShiftM || unc.slingToleranceMm || unc.hookHeightDeltaM)
  );

  const weightStepPct = unc?.weightPct && unc.weightPct > 0 ? unc.weightPct : 5;
  const cogStepM = unc?.cogShiftM && unc.cogShiftM > 0 ? unc.cogShiftM : 0.25;
  const hookDeltaM = unc?.hookHeightDeltaM && unc.hookHeightDeltaM > 0 ? unc.hookHeightDeltaM : 0.5;
  const slingTolStepMm = unc?.slingToleranceMm && unc.slingToleranceMm > 0 ? unc.slingToleranceMm : 10;

  const baseBasis: 'USER_UNCERTAINTY' | 'FINITE_DIFFERENTIAL_STEP' = hasUserUncertainties
    ? 'USER_UNCERTAINTY'
    : 'FINITE_DIFFERENTIAL_STEP';

  const evalMaxT = (
    loadT: number,
    cog: { x: number; y: number; z: number },
    hook: { x: number; y: number; z: number },
    ptsOverride = input.attachmentPoints
  ): number => {
    const out = solveRiggingStaticSystem({
      arrangementType: input.arrangementType,
      loadAtSlingsTon: loadT,
      cog,
      hookPos: hook,
      points: ptsOverride,
      hitchType: input.hitchType || 'VERTICAL',
      hasEqualizer: input.hasEqualizer,
      equalizerPairs: input.equalizerPairs,
      enforceThreeLegEffectiveForFourLeg: input.enforceThreeLegEffectiveForFourLeg,
      slingWllTon: input.slingWllTon,
      shackleEffectiveWllTon,
      shackleLateralAngleDeg: input.shackleLateralAngleDeg ?? 0,
      minAllowedAngleDeg: input.minAllowedHorizontalSlingAngleDeg ?? 45,
    });
    return out.governingLegTensionTon;
  };

  const baselineUtilPct =
    effectiveSlingWllTon && effectiveSlingWllTon > 0
      ? roundDisplay((baselineMaxTensionTon / effectiveSlingWllTon) * 100, 2)
      : null;

  const makeImpact = (
    key: string,
    nameFa: string,
    pertLabel: string,
    pertT: number
  ): SensitivityParameterImpact => {
    const delta = pertT - baselineMaxTensionTon;
    const relPct =
      baselineMaxTensionTon > 1e-6 ? roundDisplay((delta / baselineMaxTensionTon) * 100, 2) : 0;
    const pertUtil =
      effectiveSlingWllTon && effectiveSlingWllTon > 0
        ? roundDisplay((pertT / effectiveSlingWllTon) * 100, 2)
        : null;
    return {
      parameterKey: key,
      parameterNameFa: nameFa,
      perturbationLabel: pertLabel,
      baselineMaxTensionTon: roundDisplay(baselineMaxTensionTon, 3),
      perturbedMaxTensionTon: roundDisplay(pertT, 3),
      deltaTensionTon: roundDisplay(delta, 3),
      relativeImpactPct: relPct,
      baselineUtilPct,
      perturbedUtilPct: pertUtil,
      dataBasis: baseBasis,
    };
  };

  const impacts: SensitivityParameterImpact[] = [];

  // 1. Load Weight Increase
  const tWeight = evalMaxT(baseLoadAtSlingsTon * (1 + weightStepPct / 100), baseCog, baseHookPos);
  impacts.push(
    makeImpact('LOAD_WEIGHT', 'تغییر وزن بار', `+${weightStepPct}% وزن بار`, tWeight)
  );

  // 2. CoG Shift +X / -X worst
  const tCogPosX = evalMaxT(baseLoadAtSlingsTon, { ...baseCog, x: baseCog.x + cogStepM }, baseHookPos);
  const tCogNegX = evalMaxT(baseLoadAtSlingsTon, { ...baseCog, x: baseCog.x - cogStepM }, baseHookPos);
  impacts.push(
    makeImpact(
      'COG_SHIFT_X',
      'خطای مرکز ثقل (محور طولی X)',
      `±${cogStepM} m در X`,
      Math.max(tCogPosX, tCogNegX)
    )
  );

  // 3. CoG Shift +Z / -Z worst
  const tCogPosZ = evalMaxT(baseLoadAtSlingsTon, { ...baseCog, z: baseCog.z + cogStepM }, baseHookPos);
  const tCogNegZ = evalMaxT(baseLoadAtSlingsTon, { ...baseCog, z: baseCog.z - cogStepM }, baseHookPos);
  impacts.push(
    makeImpact(
      'COG_SHIFT_Z',
      'خطای مرکز ثقل (محور عرضی Z)',
      `±${cogStepM} m در Z`,
      Math.max(tCogPosZ, tCogNegZ)
    )
  );

  // 4. Lower Hook Height (Steeper / Shallower Sling Angle Sensitivity)
  const maxAttachY = Math.max(...input.attachmentPoints.map((p) => p.position.y), 0);
  const safeLowerHookY = Math.max(maxAttachY + 0.3, baseHookPos.y - hookDeltaM);
  const actualDeltaY = roundDisplay(baseHookPos.y - safeLowerHookY, 2);
  if (actualDeltaY > 0.05) {
    const tAngle = evalMaxT(baseLoadAtSlingsTon, baseCog, { ...baseHookPos, y: safeLowerHookY });
    impacts.push(
      makeImpact(
        'SLING_ANGLE_HEIGHT',
        'کاهش ارتفاع قلاب / زاویه اسلینگ',
        `-${actualDeltaY} m ارتفاع قلاب`,
        tAngle
      )
    );
  }

  // 5. Differential Sling Length Tolerance (if stiffness properties exist)
  const hasStiffness = input.attachmentPoints.some(
    (p) => (p.axialStiffnessKn && p.axialStiffnessKn > 0) || (p.elasticModulusGpa && (p.metallicAreaMm2 || p.diameterMm))
  );
  if (hasStiffness && input.attachmentPoints.length >= 4) {
    const pertPts = input.attachmentPoints.map((p, idx) =>
      idx === 0 ? { ...p, lengthToleranceMm: (p.lengthToleranceMm || 0) + slingTolStepMm } : p
    );
    const tTol = evalMaxT(baseLoadAtSlingsTon, baseCog, baseHookPos, pertPts);
    impacts.push(
      makeImpact(
        'SLING_LENGTH_TOLERANCE',
        'اختلاف طول اسلینگ (شاخه شل/کشش غیرهمسان)',
        `+${slingTolStepMm} mm تلورانس شاخه ۱`,
        tTol
      )
    );

    // 6. Stiffness mismatch (+25% stiffness on Leg 1)
    const pertStiffPts = input.attachmentPoints.map((p, idx) =>
      idx === 0 && p.axialStiffnessKn
        ? { ...p, axialStiffnessKn: p.axialStiffnessKn * 1.25 }
        : idx === 0 && p.elasticModulusGpa
          ? { ...p, elasticModulusGpa: p.elasticModulusGpa * 1.25 }
          : p
    );
    const tStiff = evalMaxT(baseLoadAtSlingsTon, baseCog, baseHookPos, pertStiffPts);
    impacts.push(
      makeImpact('SLING_STIFFNESS_VARIANCE', 'تغییر سختی محوری EA', '+25% سختی شاخه ۱', tStiff)
    );
  }

  impacts.sort((a, b) => Math.abs(b.relativeImpactPct) - Math.abs(a.relativeImpactPct));

  const gov = impacts[0] || {
    parameterKey: 'NONE',
    parameterNameFa: 'نامشخص',
    relativeImpactPct: 0,
    perturbedMaxTensionTon: baselineMaxTensionTon,
  };
  const worstCaseLegTensionTon = roundDisplay(
    Math.max(baselineMaxTensionTon, ...impacts.map((i) => i.perturbedMaxTensionTon)),
    3
  );

  return {
    governingParameterKey: gov.parameterKey,
    governingParameterFa: gov.parameterNameFa,
    maxImpactPct: gov.relativeImpactPct,
    worstCaseLegTensionTon,
    hasUserUncertainties,
    noteFa: hasUserUncertainties
      ? 'تحلیل حساسیت بر اساس تلورانس‌های عدم‌قطعیت ثبت‌شده توسط مهندس اجرا شد (بدون تولید داده تصادفی ساختگی).'
      : 'به دلیل نبود تلورانس آماری کاربر، تحلیل حساسیت قطعی به‌صورت گام‌های استاندارد (وزن +۵٪، CoG ±۰.۲۵m، قلاب -۰.۵m) برای شناسایی پارامتر حاکم انجام شد.',
    impacts,
  };
}
