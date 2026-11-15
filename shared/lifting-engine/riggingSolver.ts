import {
  EngineeringAssumption,
  EngineeringCheckItem,
  LoadCaseResult,
  ParameterTraceItem,
  RiggingEvaluationInput,
  RiggingSolverResult,
  Vector3D,
  VerificationStatus,
} from './types.ts';
import { makeStandardRef } from './standardsCatalog.ts';
import { isValidNonNegativeFinite, isValidPositiveFinite, roundDisplay } from './unitConverter.ts';
import {
  getShackleAngularDerating,
  inferArrangementType,
  solveRiggingStaticSystem,
} from './staticEquilibriumSolver.ts';
import { runRiggingSensitivityAnalysis } from './sensitivityAnalyzer.ts';

export { getShackleAngularDerating };

export function evaluateRiggingAndLoadCases(
  input: RiggingEvaluationInput,
  craneRatedCapacityTon?: number | null,
  standardsOverrides?: Record<string, { edition?: string; factors?: Record<string, any> }>
): RiggingSolverResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const parameterTrace: ParameterTraceItem[] = [];
  const engineeringAssumptions: EngineeringAssumption[] = [];

  const arrangementType = inferArrangementType(input.arrangementType, input.attachmentPoints || []);

  if (!isValidPositiveFinite(input.netLoadWeightTon)) {
    const emptyRes = solveRiggingStaticSystem({
      arrangementType,
      loadAtSlingsTon: 0,
      cog: { x: 0, y: 0, z: 0 },
      hookPos: { x: 0, y: 4, z: 0 },
      points: input.attachmentPoints || [],
      hitchType: input.hitchType || 'VERTICAL',
    });
    const emptySens = runRiggingSensitivityAnalysis(
      input,
      0,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 4, z: 0 },
      0,
      null,
      null
    );
    return {
      status: 'NOT_VERIFIED',
      arrangementType,
      grossStaticLoadTon: 0,
      designTotalLoadTon: 0,
      loadAtSlingsTon: 0,
      compositeCogM: { x: 0, y: 0, z: 0 },
      overturningMomentTonM: 0,
      cogInsideSupportPolygon: false,
      effectiveLegCount: 0,
      governingLegTensionTon: 0,
      minHorizontalAngleDeg: 0,
      maxAngleFactor: 1,
      effectiveSlingWllTon: null,
      effectiveShackleWllTon: null,
      shackleAngleDeratingFactor: 1,
      staticEquilibrium: emptyRes.staticEquilibrium,
      sensitivityAnalysis: emptySens,
      engineeringAssumptions: emptyRes.assumptions,
      legs: [],
      loadCases: [],
      checks: [
        {
          checkId: 'RIGGING_INPUT_VALIDITY',
          titleFa: 'اعتبارسنجی وزن خالص و پارامترهای پایه بار',
          titleEn: 'Net Weight & Base Rigging Input Validation',
          status: 'NOT_VERIFIED',
          actualValue: Number.isFinite(input.netLoadWeightTon) ? input.netLoadWeightTon : null,
          allowableValue: null,
          unit: 'ton',
          utilizationPct: null,
          formulaText: 'W_net > 0 و مقدار عددی معتبر الزامی است',
          standardRef: makeStandardRef('ASME_P30_1', 'Sec. 2-2.2', 'تعیین دقیق وزن بار', standardsOverrides),
        },
      ],
      parameterTrace: [
        {
          key: 'NET_WEIGHT',
          nameFa: 'وزن خالص بار',
          inputValue: Number.isFinite(input.netLoadWeightTon) ? input.netLoadWeightTon : 'NaN',
          computedValue: null,
          unit: 'ton',
          formula: 'W_net > 0',
          standardRef: 'ASME P30.1 Sec. 2-2.2',
          factors: 'DAF = -',
          assumptions: ['ورودی وزن نامعتبر یا کمتر/مساوی صفر است.'],
          validationStatus: 'NOT_VERIFIED',
          finalStatus: 'NOT_VERIFIED',
        },
      ],
      blockers: ['وزن خالص بار (Net Weight) نامعتبر، NaN یا صفر است.'],
      warnings: [],
    };
  }

  // Validate accessory/hook/spreader weights (no NaN, no negative)
  if (
    !isValidNonNegativeFinite(input.riggingAccessoryWeightTon ?? 0) ||
    !isValidNonNegativeFinite(input.hookBlockWeightTon ?? 0) ||
    !isValidNonNegativeFinite(input.spreaderBeamWeightTon ?? 0) ||
    !isValidNonNegativeFinite(input.auxiliaryWeightTon ?? 0)
  ) {
    blockers.push('یکی از اوزان الحاقی (Rigging، هوک‌بلاک یا Spreader Beam) منفی یا نامعتبر است.');
  }

  // Zero-double-counting composite mass & CoG aggregation (§5)
  let netMassTon = input.netLoadWeightTon;
  let spreaderWeight = input.spreaderBeamWeightTon ?? 0;
  let auxWeight = input.auxiliaryWeightTon ?? 0;
  let riggingAccWeight = input.riggingAccessoryWeightTon ?? 0;
  let hookBlockWeight = input.hookBlockWeightTon ?? 0;
  let compositeCog: Vector3D = {
    x: Number.isFinite(input.cogOffset?.x) ? input.cogOffset.x : 0,
    y: Number.isFinite(input.cogOffset?.y) ? input.cogOffset.y : 0,
    z: Number.isFinite(input.cogOffset?.z) ? input.cogOffset.z : 0,
  };

  if (Array.isArray(input.weightComponents) && input.weightComponents.length > 0) {
    const validComps = input.weightComponents.filter((c) => isValidNonNegativeFinite(c.weightTon));
    const sumByCat = (cat: string) =>
      validComps.filter((c) => c.category === cat).reduce((s, c) => s + c.weightTon, 0);

    const compLoad = sumByCat('LOAD');
    const compSpreader = sumByCat('SPREADER');
    const compRig = sumByCat('RIGGING');
    const compHook = sumByCat('HOOK');
    const compAux = sumByCat('AUX');

    if (compLoad > 0) netMassTon = compLoad;
    if (compSpreader > 0) spreaderWeight = compSpreader;
    if (compRig > 0) riggingAccWeight = compRig;
    if (compHook > 0) hookBlockWeight = compHook;
    if (compAux > 0) auxWeight = compAux;

    const belowHookComps = validComps.filter((c) => c.category !== 'HOOK' && c.cogPosition);
    const belowMass = belowHookComps.reduce((s, c) => s + c.weightTon, 0);
    if (belowMass > 0) {
      compositeCog = {
        x: belowHookComps.reduce((s, c) => s + c.weightTon * (c.cogPosition?.x || 0), 0) / belowMass,
        y: belowHookComps.reduce((s, c) => s + c.weightTon * (c.cogPosition?.y || 0), 0) / belowMass,
        z: belowHookComps.reduce((s, c) => s + c.weightTon * (c.cogPosition?.z || 0), 0) / belowMass,
      };
      engineeringAssumptions.push({
        id: 'ASM_COMPOSITE_COG',
        category: 'COG',
        statementFa: `مرکز ثقل مرکب از روی ${belowHookComps.length} جزء وزنی زیر قلاب (${roundDisplay(belowMass, 2)} t) به‌صورت خودکار محاسبه شد: (${roundDisplay(compositeCog.x, 3)}, ${roundDisplay(compositeCog.y, 3)}, ${roundDisplay(compositeCog.z, 3)}) m.`,
        technicalBasis: 'Weighted 3D Moment Aggregation X_cog = Σ(W_i·x_i)/ΣW_i',
        impactLevel: 'LOW',
        requiresEngineerSignoff: false,
      });
    }
  }

  const grossStaticRaw = netMassTon + riggingAccWeight + hookBlockWeight + spreaderWeight + auxWeight;
  const daf = Number.isFinite(input.dynamicFactor) && input.dynamicFactor >= 1.0 ? input.dynamicFactor : 1.1;
  if (Number.isFinite(input.dynamicFactor) && input.dynamicFactor < 1.0) {
    blockers.push(`ضریب دینامیکی (DAF=${input.dynamicFactor}) نمی‌تواند کمتر از ۱.۰۰ باشد.`);
  }

  const designTotalRaw = grossStaticRaw * daf;
  const loadAtSlingsRaw = (netMassTon + spreaderWeight + auxWeight) * daf;

  const grossStaticLoadTon = roundDisplay(grossStaticRaw, 3);
  const designTotalLoadTon = roundDisplay(designTotalRaw, 3);
  const loadAtSlingsTon = roundDisplay(loadAtSlingsRaw, 3);

  const pts =
    input.attachmentPoints && input.attachmentPoints.length > 0
      ? input.attachmentPoints
      : [
          { id: 'P1', label: 'نقطه اتصال ۱', position: { x: -1.5, y: 0.8, z: -0.8 } },
          { id: 'P2', label: 'نقطه اتصال ۲', position: { x: 1.5, y: 0.8, z: -0.8 } },
          { id: 'P3', label: 'نقطه اتصال ۳', position: { x: 1.5, y: 0.8, z: 0.8 } },
          { id: 'P4', label: 'نقطه اتصال ۴', position: { x: -1.5, y: 0.8, z: 0.8 } },
        ];

  const hookPos = input.hookPosition || { x: compositeCog.x, y: 4.5, z: compositeCog.z };
  const maxAttachY = Math.max(...pts.map((p) => p.position.y));
  if (!Number.isFinite(hookPos.y) || hookPos.y <= maxAttachY) {
    blockers.push('ارتفاع قلاب (Hook Y) باید بالاتر از تمام نقاط اتصال بار باشد.');
  }

  const hitchMultiplier =
    input.hitchType === 'CHOKER' ? 0.75 : input.hitchType === 'BASKET' ? 1.8 : 1.0;

  // Shackle angular/side-load derating per ASME B30.26 Sec. 26-1.4
  const shackleSideDeg = input.shackleLateralAngleDeg ?? 0;
  const shackleAngular = getShackleAngularDerating(shackleSideDeg);
  const effectiveSlingWllTon =
    input.slingWllTon && input.slingWllTon > 0 ? roundDisplay(input.slingWllTon * hitchMultiplier, 3) : null;
  const effectiveShackleWllRaw =
    input.shackleWllTon && input.shackleWllTon > 0 ? input.shackleWllTon * shackleAngular.factor : null;
  const effectiveShackleWllTon =
    effectiveShackleWllRaw !== null ? roundDisplay(effectiveShackleWllRaw, 3) : null;

  if (shackleAngular.status === 'FAIL') {
    blockers.push(shackleAngular.noteFa);
  } else if (shackleAngular.status === 'WARNING') {
    warnings.push(shackleAngular.noteFa);
  }

  const minAngleAllow = input.minAllowedHorizontalSlingAngleDeg ?? 45;

  // 2. Run 3D Static Equilibrium & Indeterminate Stiffness Compatibility Solver
  const staticSolved = solveRiggingStaticSystem({
    arrangementType: input.arrangementType,
    loadAtSlingsTon: loadAtSlingsRaw,
    cog: compositeCog,
    hookPos,
    points: pts,
    hitchType: input.hitchType || 'VERTICAL',
    hasEqualizer: input.hasEqualizer,
    equalizerPairs: input.equalizerPairs,
    enforceThreeLegEffectiveForFourLeg: input.enforceThreeLegEffectiveForFourLeg,
    slingWllTon: input.slingWllTon,
    shackleEffectiveWllTon: effectiveShackleWllRaw,
    shackleLateralAngleDeg: shackleSideDeg,
    minAllowedAngleDeg: minAngleAllow,
  });

  blockers.push(...staticSolved.blockers);
  warnings.push(...staticSolved.warnings);
  engineeringAssumptions.push(...staticSolved.assumptions);

  const staticEq = staticSolved.staticEquilibrium;
  const governingLegs = staticSolved.legs;
  const governingMaxTensionRaw = staticSolved.maxTensionRaw;
  const governingMinAngleRaw = staticSolved.minHorizAngleRaw;
  const governingMaxFactorRaw = staticSolved.maxAngleFactorRaw;
  const cogInsidePolygon = staticSolved.cogInsideSupportPolygon;
  const effectiveLegCount = staticSolved.effectiveLegCount;
  const cogEccentricityM = staticSolved.eccentricityM;
  const overturningMomentTonM = staticSolved.overturningMomentTonM;

  // 3. Deterministic Sensitivity Analysis (§8)
  const sensitivityAnalysis = runRiggingSensitivityAnalysis(
    { ...input, attachmentPoints: pts },
    loadAtSlingsRaw,
    compositeCog,
    hookPos,
    governingMaxTensionRaw,
    effectiveSlingWllTon,
    effectiveShackleWllRaw
  );

  // 4. Multi-Load Cases using True Static Equilibrium / Stiffness Compatibility Solver
  const caseConfigs: Array<{ id: string; nameFa: string; caseDaf: number; shift: Vector3D }> = [
    { id: 'LC1_STATIC', nameFa: 'بارگذاری استاتیک (Static DAF=1.00)', caseDaf: 1.0, shift: compositeCog },
    { id: 'LC2_DESIGN', nameFa: `بارگذاری طراحی دینامیکی (DAF=${daf})`, caseDaf: daf, shift: compositeCog },
    {
      id: 'LC3_COG_SHIFT',
      nameFa: 'حساسیت جابه‌جایی مرکز ثقل (+0.20m در X و Z)',
      caseDaf: daf,
      shift: { x: compositeCog.x + 0.2, y: compositeCog.y, z: compositeCog.z + 0.2 },
    },
  ];

  const loadCases: LoadCaseResult[] = caseConfigs.map((c) => {
    const caseTotalRaw = grossStaticRaw * c.caseDaf;
    const caseSlingLoadRaw = (netMassTon + spreaderWeight + auxWeight) * c.caseDaf;

    const lcStatic = solveRiggingStaticSystem({
      arrangementType: input.arrangementType,
      loadAtSlingsTon: caseSlingLoadRaw,
      cog: c.shift,
      hookPos,
      points: pts,
      hitchType: input.hitchType || 'VERTICAL',
      hasEqualizer: input.hasEqualizer,
      equalizerPairs: input.equalizerPairs,
      enforceThreeLegEffectiveForFourLeg: input.enforceThreeLegEffectiveForFourLeg,
      slingWllTon: input.slingWllTon,
      shackleEffectiveWllTon: effectiveShackleWllRaw,
      shackleLateralAngleDeg: shackleSideDeg,
      minAllowedAngleDeg: minAngleAllow,
    });

    const craneUtil =
      craneRatedCapacityTon && craneRatedCapacityTon > 0
        ? roundDisplay((caseTotalRaw / craneRatedCapacityTon) * 100, 2)
        : null;

    let lcStatus: VerificationStatus = 'PASS';
    if (
      !lcStatic.cogInsideSupportPolygon ||
      lcStatic.minHorizAngleRaw < 30 ||
      (craneUtil !== null && craneUtil > 100) ||
      (effectiveSlingWllTon !== null && lcStatic.maxTensionRaw > effectiveSlingWllTon) ||
      (effectiveShackleWllRaw !== null && lcStatic.maxTensionRaw > effectiveShackleWllRaw)
    ) {
      lcStatus = 'FAIL';
    } else if (
      lcStatic.staticEquilibrium.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' ||
      lcStatic.staticEquilibrium.solutionMethod === 'RIGID_SUBSET_ENVELOPE_UNVERIFIED' ||
      craneUtil === null ||
      effectiveSlingWllTon === null
    ) {
      lcStatus = 'NOT_VERIFIED';
    } else if (
      !lcStatic.staticEquilibrium.residuals.converged ||
      lcStatic.minHorizAngleRaw < minAngleAllow ||
      craneUtil > 85 ||
      lcStatic.staticEquilibrium.slackLegIds.length > 0
    ) {
      lcStatus = 'WARNING';
    }

    return {
      caseId: c.id,
      caseNameFa: c.nameFa,
      dafApplied: c.caseDaf,
      cogShiftM: {
        x: roundDisplay(c.shift.x, 3),
        y: roundDisplay(c.shift.y, 3),
        z: roundDisplay(c.shift.z, 3),
      },
      grossStaticLoadTon,
      designFactoredLoadTon: roundDisplay(caseTotalRaw, 3),
      maxLegTensionTon: lcStatic.governingLegTensionTon,
      minHorizontalAngleDeg: roundDisplay(lcStatic.minHorizAngleRaw, 2),
      craneUtilizationPct: craneUtil,
      status: lcStatus,
    };
  });

  const governingLegTensionTon = roundDisplay(governingMaxTensionRaw, 3);
  const minHorizontalAngleDeg = roundDisplay(governingMinAngleRaw, 2);
  const maxAngleFactor = roundDisplay(governingMaxFactorRaw, 4);

  // Formal Engineering Checks
  const checks: EngineeringCheckItem[] = [];
  const slingStdRef = makeStandardRef(
    'ASME_B30_9',
    'Sec. 9-1.7 & Sec. 9-2.9',
    'محاسبه کشش سه‌بعدی شاخه‌های اسلینگ با اعمال ضریب زاویه 1/sin(θ) و کنترل حداقل زاویه افقی',
    standardsOverrides
  );
  const eqStdRef = makeStandardRef(
    'ASME_P30_1',
    'Sec. 2-2.2 / Static Equilibrium',
    'تعادل استاتیکی ۶ درجه آزادی و سازگاری سختی سیستم‌های نامعین باربرداری',
    standardsOverrides
  );

  // Check A: Static Determinacy & Mechanical Data Completeness (§3-4)
  const isUnverifiedIndeterminate =
    staticEq.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' ||
    staticEq.solutionMethod === 'RIGID_SUBSET_ENVELOPE_UNVERIFIED' ||
    !staticEq.compatibilityVerified;
  const detStatus: VerificationStatus = isUnverifiedIndeterminate
    ? 'NOT_VERIFIED'
    : staticEq.slackLegIds.length > 0 || staticEq.determinacyClassification === 'EQUALIZER_REDUCED'
      ? 'WARNING'
      : 'PASS';

  checks.push({
    checkId: 'STATIC_DETERMINACY',
    titleFa: 'تحلیل معینی استاتیکی (Static Determinacy) و اعتبار روش حل',
    titleEn: 'Static Determinacy & Solver Method Verification',
    status: detStatus,
    actualValue: staticEq.degreeOfIndeterminacy,
    allowableValue: 0,
    unit: 'DSI',
    utilizationPct: null,
    formulaText: `Unknowns=${staticEq.unknownCount}, Rank=${staticEq.independentEquationsCount}, DSI=${staticEq.degreeOfIndeterminacy}, Method=${staticEq.solutionMethod}`,
    standardRef: eqStdRef,
    notesFa: staticEq.diagnosisFa,
  });

  // Check B: 6-DOF Equilibrium Residual Verification (§10)
  const resReport = staticEq.residuals;
  const residualStatus: VerificationStatus =
    staticEq.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' ||
    staticEq.solutionMethod === 'RIGID_SUBSET_ENVELOPE_UNVERIFIED'
      ? 'NOT_VERIFIED'
      : !staticEq.noCompressionVerified
        ? 'FAIL'
        : resReport.converged
          ? 'PASS'
          : resReport.maxForceResidualTon > 0.25 || resReport.maxMomentResidualTonM > 0.5
            ? 'FAIL'
            : 'WARNING';

  if (residualStatus === 'FAIL' && staticEq.solutionMethod !== 'INSUFFICIENT_DATA_NOT_VERIFIED') {
    blockers.push(
      `عدم ارضای معادلات تعادل ۶ درجه آزادی: خطای باقیمانده نیرو=${resReport.maxForceResidualTon} t، خطای گشتاور=${resReport.maxMomentResidualTonM} t·m.`
    );
  }

  checks.push({
    checkId: 'STATIC_EQUILIBRIUM_6DOF',
    titleFa: 'صحت‌سنجی باقیمانده معادلات تعادل استاتیکی ۶ درجه آزادی (Residuals)',
    titleEn: '6-DOF Static Equilibrium Residual Convergence',
    status: residualStatus,
    actualValue: resReport.maxForceResidualTon,
    allowableValue: resReport.toleranceTon,
    unit: 'ton',
    utilizationPct: null,
    formulaText: `ΣFx=${resReport.sumFxTon}t, ΣFy=${resReport.sumFyTon}t, ΣFz=${resReport.sumFzTon}t | ΣMx=${resReport.sumMxTonM}, ΣMy=${resReport.sumMyTonM}, ΣMz=${resReport.sumMzTonM} t·m`,
    standardRef: eqStdRef,
  });

  // Check 0: CoG Stability / Support Polygon Check
  const cogStatus: VerificationStatus = cogInsidePolygon ? (cogEccentricityM > 0.35 ? 'WARNING' : 'PASS') : 'FAIL';
  checks.push({
    checkId: 'COG_STABILITY',
    titleFa: 'پایداری مرکز ثقل (CoG) درون چندضلعی نقاط اتصال و گشتاور برون‌محوری',
    titleEn: 'Center of Gravity Support Polygon & Eccentricity Check',
    status: cogStatus,
    actualValue: roundDisplay(cogEccentricityM, 3),
    allowableValue: null,
    unit: 'm',
    utilizationPct: null,
    formulaText: `CoG=(${roundDisplay(compositeCog.x, 3)}, ${roundDisplay(compositeCog.z, 3)})m, Ecc=${roundDisplay(cogEccentricityM, 3)}m, M_ovt=${overturningMomentTonM} t·m`,
    standardRef: makeStandardRef('ASME_P30_1', 'Sec. 2-2.2', 'تعادل مرکز ثقل بار و کنترل برون‌محوری', standardsOverrides),
  });

  // Check 1: Sling Horizontal Angle
  const angleStatus: VerificationStatus =
    minHorizontalAngleDeg < 30 ? 'FAIL' : minHorizontalAngleDeg < minAngleAllow ? 'WARNING' : 'PASS';
  if (angleStatus === 'FAIL') {
    blockers.push(`حداقل زاویه افقی اسلینگ (${minHorizontalAngleDeg}°) کمتر از حد مطلق ۳۰ درجه (ASME B30.9) است.`);
  } else if (angleStatus === 'WARNING') {
    warnings.push(
      `زاویه افقی اسلینگ (${minHorizontalAngleDeg}°) کمتر از ${minAngleAllow}° است؛ افزایش طول اسلینگ یا استفاده از Spreader توصیه می‌شود.`
    );
  }
  checks.push({
    checkId: 'SLING_ANGLE',
    titleFa: 'کنترل حداقل زاویه افقی اسلینگ (Sling Angle)',
    titleEn: 'Minimum Horizontal Sling Angle',
    status: angleStatus,
    actualValue: minHorizontalAngleDeg,
    allowableValue: minAngleAllow,
    remainingCapacity: roundDisplay(minHorizontalAngleDeg - 30, 2),
    unit: 'deg',
    utilizationPct: minHorizontalAngleDeg > 0 ? roundDisplay((minAngleAllow / minHorizontalAngleDeg) * 100, 2) : null,
    formulaText: `θ_h = arcsin(ΔY / L_sling) = ${minHorizontalAngleDeg}° (1/sin θ = ${maxAngleFactor})`,
    standardRef: slingStdRef,
  });

  // Check 2: Sling WLL Capacity
  const slingUtil =
    effectiveSlingWllTon && effectiveSlingWllTon > 0
      ? roundDisplay((governingMaxTensionRaw / effectiveSlingWllTon) * 100, 2)
      : null;
  const remSlingCap =
    effectiveSlingWllTon !== null ? roundDisplay(effectiveSlingWllTon - governingMaxTensionRaw, 3) : null;
  const slingStatus: VerificationStatus =
    isUnverifiedIndeterminate
      ? 'NOT_VERIFIED'
      : slingUtil === null
        ? 'NOT_VERIFIED'
        : slingUtil > 100
          ? 'FAIL'
          : slingUtil > 85
            ? 'WARNING'
            : 'PASS';

  if (slingUtil === null) {
    blockers.push('ظرفیت مجاز اسلینگ (Sling WLL) انتخاب یا وارد نشده است.');
  } else if (!isUnverifiedIndeterminate && slingStatus === 'FAIL') {
    blockers.push(
      `نیروی کشش شاخه حاکم (${governingLegTensionTon} تن) از ظرفیت مؤثر اسلینگ (${effectiveSlingWllTon} تن) بیشتر است.`
    );
  }
  checks.push({
    checkId: 'SLING_WLL',
    titleFa: 'کنترل کشش حاکم شاخه اسلینگ در برابر WLL و ظرفیت باقی‌مانده',
    titleEn: 'Governing Sling Tension vs Effective WLL',
    status: slingStatus,
    actualValue: isUnverifiedIndeterminate && staticEq.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' ? null : governingLegTensionTon,
    allowableValue: effectiveSlingWllTon,
    remainingCapacity: remSlingCap,
    unit: 'ton',
    utilizationPct: isUnverifiedIndeterminate ? null : slingUtil,
    formulaText:
      staticEq.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED'
        ? 'توزیع قطعی به علت نبود سختی (EA) قابل محاسبه نیست — نیازمند داده مکانیکی یا Equalizer'
        : `T_max = ${governingLegTensionTon}t vs WLL_eff = ${effectiveSlingWllTon ?? 'N/A'}t (Hitch×${hitchMultiplier})`,
    standardRef: slingStdRef,
  });

  // Check 3: Shackle WLL Capacity (including ASME B30.26 angular derating)
  const shackleRef = makeStandardRef(
    'ASME_B30_26',
    'Sec. 26-1.4',
    'کنترل ظرفیت شگل، کاهش ظرفیت زاویه‌ای و انطباق پین با سوراخ گونیا',
    standardsOverrides
  );
  const shackleUtil =
    effectiveShackleWllRaw && effectiveShackleWllRaw > 0
      ? roundDisplay((governingMaxTensionRaw / effectiveShackleWllRaw) * 100, 2)
      : null;
  const remShackleCap =
    effectiveShackleWllRaw !== null ? roundDisplay(effectiveShackleWllRaw - governingMaxTensionRaw, 3) : null;
  const shackleStatus: VerificationStatus =
    shackleAngular.status === 'FAIL'
      ? 'FAIL'
      : isUnverifiedIndeterminate || shackleUtil === null
        ? 'NOT_VERIFIED'
        : shackleUtil > 100
          ? 'FAIL'
          : shackleUtil > 85 || shackleAngular.status === 'WARNING'
            ? 'WARNING'
            : 'PASS';

  if (shackleStatus === 'FAIL' && shackleUtil !== null && shackleUtil > 100) {
    blockers.push(`بار وارد بر شگل (${governingLegTensionTon} تن) از WLL مؤثر شگل (${effectiveShackleWllTon} تن) فراتر است.`);
  } else if (shackleUtil === null) {
    warnings.push('ظرفیت شگل (Shackle WLL) مشخص نشده است.');
  }
  checks.push({
    checkId: 'SHACKLE_WLL',
    titleFa: 'کنترل ظرفیت شگل و ضریب کاهش زاویه‌ای (ASME B30.26)',
    titleEn: 'Shackle WLL & Side-Load Derating Check',
    status: shackleStatus,
    actualValue: isUnverifiedIndeterminate && staticEq.solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' ? null : governingLegTensionTon,
    allowableValue: effectiveShackleWllTon,
    remainingCapacity: remShackleCap,
    unit: 'ton',
    utilizationPct: isUnverifiedIndeterminate ? null : shackleUtil,
    formulaText: `F_shackle=${governingLegTensionTon}t vs WLL_eff = WLL(${input.shackleWllTon ?? 'N/A'}t) × Factor(${shackleAngular.factor}) = ${effectiveShackleWllTon ?? 'N/A'}t`,
    standardRef: shackleRef,
  });

  // Check 4: Optional Shackle Pin vs Lug Hole Compatibility
  if (isValidPositiveFinite(input.shacklePinDiameterMm) && isValidPositiveFinite(input.lugHoleDiameterMm)) {
    const clearanceMm = input.lugHoleDiameterMm - input.shacklePinDiameterMm;
    const pinStatus: VerificationStatus =
      clearanceMm <= 0 ? 'FAIL' : clearanceMm > 6 ? 'WARNING' : 'PASS';
    if (pinStatus === 'FAIL') {
      blockers.push(
        `قطر پین شگل (${input.shacklePinDiameterMm} mm) از سوراخ اتصال (${input.lugHoleDiameterMm} mm) بزرگ‌تر یا برابر است.`
      );
    } else if (pinStatus === 'WARNING') {
      warnings.push(`لقی بین سوراخ و پین شگل (${roundDisplay(clearanceMm, 2)} mm) بیش از ۶ میلی‌متر است.`);
    }
    checks.push({
      checkId: 'SHACKLE_PIN_FIT',
      titleFa: 'انطباق قطر پین شگل با سوراخ نقطه اتصال',
      titleEn: 'Shackle Pin-to-Hole Compatibility',
      status: pinStatus,
      actualValue: input.shacklePinDiameterMm,
      allowableValue: input.lugHoleDiameterMm,
      remainingCapacity: roundDisplay(clearanceMm, 2),
      unit: 'mm',
      utilizationPct: roundDisplay((input.shacklePinDiameterMm / input.lugHoleDiameterMm) * 100, 1),
      formulaText: `d_pin=${input.shacklePinDiameterMm}mm < d_hole=${input.lugHoleDiameterMm}mm (Clearance=${roundDisplay(clearanceMm, 2)}mm)`,
      standardRef: shackleRef,
    });
  } else {
    checks.push({
      checkId: 'SHACKLE_PIN_FIT',
      titleFa: 'انطباق قطر پین شگل با سوراخ نقطه اتصال',
      titleEn: 'Shackle Pin-to-Hole Compatibility',
      status: 'NOT_APPLICABLE',
      actualValue: null,
      allowableValue: null,
      unit: 'mm',
      utilizationPct: null,
      formulaText: 'قطر پین یا قطر سوراخ گوشواره وارد نشده است (اختیاری)',
      standardRef: shackleRef,
    });
  }

  // Check 5: Sensitivity Governing Risk
  const sensLimitPct = effectiveSlingWllTon && effectiveSlingWllTon > 0
    ? roundDisplay((sensitivityAnalysis.worstCaseLegTensionTon / effectiveSlingWllTon) * 100, 2)
    : null;
  const sensStatus: VerificationStatus = isUnverifiedIndeterminate
    ? 'NOT_VERIFIED'
    : sensLimitPct !== null && sensLimitPct > 105
      ? 'WARNING'
      : 'PASS';
  checks.push({
    checkId: 'SENSITIVITY_GOVERNING',
    titleFa: 'تحلیل حساسیت پارامتریک و شناسایی پارامتر حاکم',
    titleEn: 'Parametric Sensitivity Governing Factor',
    status: sensStatus,
    actualValue: sensitivityAnalysis.worstCaseLegTensionTon,
    allowableValue: effectiveSlingWllTon,
    unit: 'ton',
    utilizationPct: sensLimitPct,
    formulaText: `پارامتر حاکم: ${sensitivityAnalysis.governingParameterFa} (اثر ${sensitivityAnalysis.maxImpactPct}% → T_worst=${sensitivityAnalysis.worstCaseLegTensionTon} t)`,
    standardRef: eqStdRef,
  });

  // Overall Rigging Solver Status across 5 strict states
  let overallStatus: VerificationStatus = 'PASS';
  if (
    checks.some((c) => c.status === 'FAIL') ||
    !cogInsidePolygon ||
    minHorizontalAngleDeg < 30 ||
    hookPos.y <= maxAttachY
  ) {
    overallStatus = 'FAIL';
  } else if (checks.some((c) => c.status === 'NOT_VERIFIED')) {
    overallStatus = 'NOT_VERIFIED';
  } else if (checks.some((c) => c.status === 'WARNING') || warnings.length > 0) {
    overallStatus = 'WARNING';
  }

  // Build mandatory 10-attribute ParameterTraceItem[]
  parameterTrace.push(
    {
      key: 'GROSS_HOOK_LOAD',
      nameFa: 'وزن کل استاتیکی روی قلاب (بدون شمارش تکراری)',
      inputValue: `Net=${netMassTon}t, Rig=${riggingAccWeight}t, Hook=${hookBlockWeight}t, Spreader=${spreaderWeight}t`,
      computedValue: grossStaticLoadTon,
      unit: 'ton',
      formula: 'W_gross = W_net + W_rigging + W_hook + W_spreader + W_aux',
      standardRef: 'ASME P30.1 Sec. 2-2.2',
      factors: 'DAF استاتیک = 1.00',
      assumptions: ['اجزای وزن به‌صورت مجزا و بدون هم‌پوشانی جمع شده‌اند.'],
      validationStatus: grossStaticLoadTon > 0 ? 'PASS' : 'NOT_VERIFIED',
      finalStatus: grossStaticLoadTon > 0 ? 'PASS' : 'NOT_VERIFIED',
    },
    {
      key: 'DESIGN_HOOK_LOAD',
      nameFa: 'بار کل طراحی با اعمال ضریب دینامیکی',
      inputValue: `W_gross=${grossStaticLoadTon}t, DAF=${daf}`,
      computedValue: designTotalLoadTon,
      unit: 'ton',
      formula: 'W_design = W_gross × DAF',
      standardRef: 'ASME P30.1 Sec. 2-2.2 / BTH-1',
      factors: `DAF = ${daf}`,
      assumptions: [`بار وارد بر شاخه‌های اسلینگ (بدون هوک‌بلاک) = ${loadAtSlingsTon} تن`],
      validationStatus: daf >= 1.0 ? 'PASS' : 'FAIL',
      finalStatus: daf >= 1.0 ? 'PASS' : 'FAIL',
    },
    {
      key: 'STATIC_EQUILIBRIUM_SOLVER',
      nameFa: 'حلگر تعادل استاتیکی ۶ درجه آزادی و سازگاری سختی',
      inputValue: `${arrangementType} (${staticEq.unknownCount} شاخه | Rank=${staticEq.independentEquationsCount})`,
      computedValue: `${staticEq.determinacyClassification} | ΔF=${resReport.maxForceResidualTon}t | ΔM=${resReport.maxMomentResidualTonM}t·m`,
      unit: 'DSI / t·m',
      formula: 'ΣF = 0, ΣM = 0 + K·Δ = F (Tension-Only Active-Set)',
      standardRef: 'ASME P30.1 / Structural Equilibrium',
      factors: `Method=${staticEq.solutionMethod}, ActiveLegs=${staticEq.activeLegCount}/${staticEq.unknownCount}`,
      assumptions: [staticEq.diagnosisFa],
      validationStatus: detStatus,
      finalStatus: residualStatus === 'FAIL' ? 'FAIL' : detStatus,
    },
    {
      key: 'COG_3D_EQUILIBRIUM',
      nameFa: 'موقعیت مرکز ثقل (CoG) و برون‌محوری',
      inputValue: `(${roundDisplay(compositeCog.x, 3)}, ${roundDisplay(compositeCog.y, 3)}, ${roundDisplay(compositeCog.z, 3)})`,
      computedValue: `Ecc=${roundDisplay(cogEccentricityM, 3)}m | M_ovt=${overturningMomentTonM} t·m`,
      unit: 'm / t·m',
      formula: 'M_ovt = W_slings × √(Δx² + Δz²)',
      standardRef: 'ASME P30.1 Sec. 2-2.2',
      factors: `Inside Support Polygon = ${cogInsidePolygon ? 'YES' : 'NO'}`,
      assumptions: [
        staticEq.solutionMethod === 'RIGID_SUBSET_ENVELOPE_UNVERIFIED'
          ? 'پوش بدترین ۳ شاخه ASME B30.9 لحاظ شد (فاقد اطلاعات سختی EA).'
          : `آرایش سیستم: ${arrangementType}`,
      ],
      validationStatus: cogStatus,
      finalStatus: cogStatus,
    },
    {
      key: 'SLING_ANGLE_FACTOR',
      nameFa: 'حداقل زاویه افقی و ضریب کشش اسلینگ',
      inputValue: `HookY=${hookPos.y}m, MaxAttachY=${maxAttachY}m`,
      computedValue: `${minHorizontalAngleDeg}° (Factor=${maxAngleFactor})`,
      unit: 'deg',
      formula: 'θ_h = arcsin(ΔY / L_sling), K_angle = 1 / sin(θ_h)',
      standardRef: 'ASME B30.9 Sec. 9-1.7',
      factors: `Min Allowed=${minAngleAllow}°, Absolute Min=30°`,
      assumptions: ['زاویه کمتر از ۳۰ درجه به‌صورت قطعی مردود است.'],
      validationStatus: angleStatus,
      finalStatus: angleStatus,
    },
    {
      key: 'GOVERNING_SLING_TENSION',
      nameFa: 'کشش بحرانی شاخه اسلینگ در برابر WLL مؤثر',
      inputValue: input.slingWllTon ?? null,
      computedValue: `${governingLegTensionTon} / ${effectiveSlingWllTon ?? 'N/A'} (Rem: ${remSlingCap ?? 'N/A'})`,
      unit: 'ton',
      formula: 'T_gov = max(T_i solved via 6-DOF/Stiffness) vs WLL × HitchMultiplier',
      standardRef: 'ASME B30.9 Sec. 9-2.9',
      factors: `Hitch (${input.hitchType || 'VERTICAL'}) = ×${hitchMultiplier}`,
      assumptions: ['محاسبه بدون فرض برابری کورکورانه W/4 انجام شده است.'],
      validationStatus: slingStatus,
      finalStatus: slingStatus,
    },
    {
      key: 'SHACKLE_CAPACITY_DERATING',
      nameFa: 'ظرفیت مؤثر شگل و اثر بارگذاری جانبی',
      inputValue: input.shackleWllTon ? `${input.shackleWllTon}t @ ${shackleSideDeg}°` : null,
      computedValue: `${governingLegTensionTon} / ${effectiveShackleWllTon ?? 'N/A'} (Rem: ${remShackleCap ?? 'N/A'})`,
      unit: 'ton',
      formula: 'WLL_shk,eff = WLL_shk × K_angular(β)',
      standardRef: 'ASME B30.26 Sec. 26-1.4',
      factors: `Side Angle Derating = ×${shackleAngular.factor}`,
      assumptions: [shackleAngular.noteFa],
      validationStatus: shackleStatus,
      finalStatus: shackleStatus,
    },
    {
      key: 'SENSITIVITY_ANALYSIS',
      nameFa: 'تحلیل حساسیت پارامتریک و پارامتر حاکم',
      inputValue: sensitivityAnalysis.hasUserUncertainties ? 'عدم‌قطعیت ثبت‌شده کاربر' : 'گام‌های دیفرانسیلی استاندارد',
      computedValue: `${sensitivityAnalysis.governingParameterFa} (+${sensitivityAnalysis.maxImpactPct}%)`,
      unit: '%',
      formula: 'ΔT / T_base across Weight, CoG X/Z, Angle, Length Tol, EA',
      standardRef: 'ASME P30.1 Engineering Sensitivity',
      factors: `T_worst = ${sensitivityAnalysis.worstCaseLegTensionTon} t`,
      assumptions: [sensitivityAnalysis.noteFa],
      validationStatus: sensStatus,
      finalStatus: sensStatus,
    }
  );

  return {
    status: overallStatus,
    arrangementType,
    grossStaticLoadTon,
    designTotalLoadTon,
    loadAtSlingsTon,
    compositeCogM: {
      x: roundDisplay(compositeCog.x, 3),
      y: roundDisplay(compositeCog.y, 3),
      z: roundDisplay(compositeCog.z, 3),
    },
    overturningMomentTonM,
    cogInsideSupportPolygon: cogInsidePolygon,
    effectiveLegCount,
    governingLegTensionTon,
    minHorizontalAngleDeg,
    maxAngleFactor,
    effectiveSlingWllTon,
    effectiveShackleWllTon,
    shackleAngleDeratingFactor: shackleAngular.factor,
    staticEquilibrium: staticEq,
    sensitivityAnalysis,
    engineeringAssumptions: Array.from(
      new Map(engineeringAssumptions.map((a) => [a.id, a])).values()
    ),
    legs: governingLegs,
    loadCases,
    checks,
    parameterTrace,
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
  };
}
