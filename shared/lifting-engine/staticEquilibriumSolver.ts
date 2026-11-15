import {
  AttachmentPointInput,
  DeterminacyClassification,
  EngineeringAssumption,
  EquilibriumResidualReport,
  LegParticipationStatus,
  SlingArrangementType,
  SlingLegResult,
  StaticEquilibriumReport,
  StaticSolutionMethod,
  Vector3D,
  VerificationStatus,
} from './types.ts';
import { roundDisplay } from './unitConverter.ts';

/**
 * Computes ASME B30.26 Sec. 26-1.4 angular / side-load derating factor for shackles loaded in-plane off-axis.
 */
export function getShackleAngularDerating(lateralAngleDeg: number): {
  factor: number;
  status: VerificationStatus;
  noteFa: string;
} {
  const absDeg = Math.abs(lateralAngleDeg || 0);
  if (!Number.isFinite(absDeg) || absDeg > 90) {
    return {
      factor: 0,
      status: 'FAIL',
      noteFa: `زاویه بارگذاری جانبی شگل (${roundDisplay(absDeg, 1)}°) بیش از ۹۰ درجه و غیرمجاز است (ASME B30.26).`,
    };
  }
  if (absDeg <= 5) {
    return { factor: 1.0, status: 'PASS', noteFa: 'بارگذاری محوری شگل (≤ 5°) بدون کاهش ظرفیت (ضریب ۱.۰۰).' };
  }
  if (absDeg <= 45) {
    return {
      factor: 0.7,
      status: 'WARNING',
      noteFa: `بارگذاری زاویه‌ای شگل (${roundDisplay(absDeg, 1)}° در بازه ۶ تا ۴۵ درجه) — اعمال ضریب کاهش ۰.۷۰ مطابق ASME B30.26.`,
    };
  }
  return {
    factor: 0.5,
    status: 'WARNING',
    noteFa: `بارگذاری زاویه‌ای شدید شگل (${roundDisplay(absDeg, 1)}° در بازه ۴۶ تا ۹۰ درجه) — اعمال ضریب کاهش ۰.۵۰ مطابق ASME B30.26.`,
  };
}

const G_TO_KN_PER_TON = 9.80665;
const FORCE_RESIDUAL_TOL_TON = 1e-3;
const MOMENT_RESIDUAL_TOL_TONM = 5e-2;

interface LegGeometryAndStiffness {
  index: number;
  input: AttachmentPointInput;
  lowerPos: Vector3D;
  upperPos: Vector3D;
  geomLengthM: number;
  effectiveLengthM: number;
  toleranceM: number;
  unitVec: Vector3D; // lower -> upper
  horizontalAngleDeg: number;
  verticalAngleDeg: number;
  angleFactor: number;
  stiffnessTonPerM: number | null; // k = EA/L combined in series with k_conn (in tonf/m)
  axialStiffnessEaKn: number | null;
  hasValidStiffness: boolean;
  missingStiffnessReasons: string[];
}

export function pointInConvexHull2D(x: number, z: number, pts: Vector3D[]): boolean {
  if (pts.length < 3) return false;
  const sorted = [...pts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.z - b.z));
  const cross = (o: Vector3D, a: Vector3D, b: Vector3D) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

  const lower: Vector3D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vector3D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) {
      upper.pop();
    }
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length < 3) return false;

  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const edgeLen = Math.hypot(b.x - a.x, b.z - a.z);
    if (edgeLen < 1e-9) continue;
    const signedDist = ((b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x)) / edgeLen;
    if (signedDist < -1e-4) {
      return false;
    }
  }
  return true;
}

/**
 * Gaussian elimination with partial pivoting for small dense systems A x = b
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0 || A.length !== n) return null;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = r;
      }
    }
    if (maxVal < 1e-10) return null;
    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }
    const pivot = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-14) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }
  return M.map((row) => row[n]);
}

function computeMatrixRank(matrix: number[][], tol = 1e-6): number {
  const m = matrix.length;
  if (m === 0) return 0;
  const n = matrix[0]?.length || 0;
  if (n === 0) return 0;
  const A = matrix.map((r) => [...r]);
  let rank = 0;
  for (let col = 0; col < n && rank < m; col++) {
    let pivotRow = rank;
    let best = Math.abs(A[pivotRow][col]);
    for (let r = rank + 1; r < m; r++) {
      const val = Math.abs(A[r][col]);
      if (val > best) {
        best = val;
        pivotRow = r;
      }
    }
    if (best <= tol) continue;
    [A[rank], A[pivotRow]] = [A[pivotRow], A[rank]];
    const pv = A[rank][col];
    for (let r = rank + 1; r < m; r++) {
      const factor = A[r][col] / pv;
      if (Math.abs(factor) < 1e-14) continue;
      for (let c = col; c < n; c++) {
        A[r][c] -= factor * A[rank][c];
      }
    }
    rank++;
  }
  return rank;
}

function deriveLegStiffness(
  pt: AttachmentPointInput,
  effLenM: number
): {
  eaKn: number | null;
  stiffnessTonPerM: number | null;
  valid: boolean;
  missingReasons: string[];
} {
  const missingReasons: string[] = [];
  let eaKn: number | null = null;

  if (pt.axialStiffnessKn !== undefined && Number.isFinite(pt.axialStiffnessKn) && pt.axialStiffnessKn > 0) {
    eaKn = pt.axialStiffnessKn;
  } else if (
    pt.elasticModulusGpa !== undefined &&
    Number.isFinite(pt.elasticModulusGpa) &&
    pt.elasticModulusGpa > 0
  ) {
    let areaMm2: number | null = null;
    if (pt.metallicAreaMm2 !== undefined && Number.isFinite(pt.metallicAreaMm2) && pt.metallicAreaMm2 > 0) {
      areaMm2 = pt.metallicAreaMm2;
    } else if (pt.diameterMm !== undefined && Number.isFinite(pt.diameterMm) && pt.diameterMm > 0) {
      if (pt.materialType === 'ALLOY_CHAIN') {
        // Two chain bar cross-sections carry load in tension
        areaMm2 = 2 * Math.PI * (pt.diameterMm / 2) ** 2;
      } else if (pt.materialType === 'WIRE_ROPE') {
        // Metallic fill factor ~0.58 for IWRC wire rope requires explicit note
        areaMm2 = 0.58 * Math.PI * (pt.diameterMm / 2) ** 2;
      }
    }
    if (areaMm2 !== null && areaMm2 > 0) {
      // 1 GPa * 1 mm² = 1 kN exact
      eaKn = pt.elasticModulusGpa * areaMm2;
    } else {
      missingReasons.push(`سطح مقطع مؤثر (mm²) شاخه «${pt.label}» مشخص نشده است.`);
    }
  } else {
    missingReasons.push(
      `سختی محوری سازنده (EA به kN) یا مدول الاستیسیته و سطح مقطع شاخه «${pt.label}» وارد نشده است.`
    );
  }

  if (eaKn === null || effLenM <= 1e-6) {
    return { eaKn: null, stiffnessTonPerM: null, valid: false, missingReasons };
  }

  const kSlingKnPerM = eaKn / effLenM;
  let kCombinedKnPerM = kSlingKnPerM;
  if (
    pt.connectionStiffnessKnPerM !== undefined &&
    Number.isFinite(pt.connectionStiffnessKnPerM) &&
    pt.connectionStiffnessKnPerM > 0
  ) {
    kCombinedKnPerM = 1 / (1 / kSlingKnPerM + 1 / pt.connectionStiffnessKnPerM);
  }

  return {
    eaKn,
    stiffnessTonPerM: kCombinedKnPerM / G_TO_KN_PER_TON,
    valid: true,
    missingReasons: [],
  };
}

export function inferArrangementType(
  explicit: SlingArrangementType | undefined,
  pts: AttachmentPointInput[]
): SlingArrangementType {
  if (explicit) return explicit;
  const n = pts.length;
  if (n <= 1) return 'SINGLE_LEG';
  if (n === 2) return 'TWO_LEG';
  if (n === 3) return 'THREE_LEG';
  if (n === 4) return 'FOUR_LEG';
  return 'MULTI_LEG';
}

function checkGeometrySymmetry(geoms: LegGeometryAndStiffness[], cog: Vector3D): {
  symmetricGeometry: boolean;
  symmetricLoading: boolean;
} {
  if (geoms.length <= 1) return { symmetricGeometry: true, symmetricLoading: true };
  const lengths = geoms.map((g) => g.effectiveLengthM);
  const angles = geoms.map((g) => g.horizontalAngleDeg);
  const minL = Math.min(...lengths);
  const maxL = Math.max(...lengths);
  const minA = Math.min(...angles);
  const maxA = Math.max(...angles);
  const symmetricGeometry = maxL - minL < 0.02 && maxA - minA < 1.0;

  const avgX = geoms.reduce((s, g) => s + g.lowerPos.x, 0) / geoms.length;
  const avgZ = geoms.reduce((s, g) => s + g.lowerPos.z, 0) / geoms.length;
  const cogOffsetFromCentroid = Math.hypot(cog.x - avgX, cog.z - avgZ);
  const stiffnesses = geoms.map((g) => g.stiffnessTonPerM).filter((v): v is number => v !== null);
  const stiffUniform =
    stiffnesses.length === geoms.length
      ? Math.max(...stiffnesses) - Math.min(...stiffnesses) < 0.02 * Math.max(...stiffnesses)
      : true;

  return {
    symmetricGeometry,
    symmetricLoading: symmetricGeometry && cogOffsetFromCentroid < 0.03 && stiffUniform,
  };
}

function compute6DofResiduals(
  tensions: number[],
  geoms: LegGeometryAndStiffness[],
  loadTon: number,
  cog: Vector3D
): EquilibriumResidualReport {
  let sumFx = 0;
  let sumFy = 0;
  let sumFz = 0;
  let sumMx = 0;
  let sumMy = 0;
  let sumMz = 0;

  for (let i = 0; i < geoms.length; i++) {
    const T = tensions[i] ?? 0;
    const g = geoms[i];
    const fx = T * g.unitVec.x;
    const fy = T * g.unitVec.y;
    const fz = T * g.unitVec.z;
    sumFx += fx;
    sumFy += fy;
    sumFz += fz;

    const rx = g.lowerPos.x - cog.x;
    const ry = g.lowerPos.y - cog.y;
    const rz = g.lowerPos.z - cog.z;
    sumMx += ry * fz - rz * fy;
    sumMy += rz * fx - rx * fz;
    sumMz += rx * fy - ry * fx;
  }

  // Gravity acts downward at CoG: (0, -W, 0) -> zero moment around CoG itself
  sumFy -= loadTon;

  const maxForce = Math.max(Math.abs(sumFx), Math.abs(sumFy), Math.abs(sumFz));
  const maxMoment = Math.max(Math.abs(sumMx), Math.abs(sumMy), Math.abs(sumMz));
  const converged = maxForce <= FORCE_RESIDUAL_TOL_TON && maxMoment <= MOMENT_RESIDUAL_TOL_TONM;

  return {
    sumFxTon: roundDisplay(sumFx, 6),
    sumFyTon: roundDisplay(sumFy, 6),
    sumFzTon: roundDisplay(sumFz, 6),
    sumMxTonM: roundDisplay(sumMx, 5),
    sumMyTonM: roundDisplay(sumMy, 5),
    sumMzTonM: roundDisplay(sumMz, 5),
    maxForceResidualTon: roundDisplay(maxForce, 6),
    maxMomentResidualTonM: roundDisplay(maxMoment, 5),
    converged,
    toleranceTon: FORCE_RESIDUAL_TOL_TON,
    toleranceTonM: MOMENT_RESIDUAL_TOL_TONM,
  };
}

/**
 * Computes exact vertical shares along lines/planes for 1 or 2-leg statically determinate configurations
 * without clamping instability.
 */
function solveTwoLegPlanarEquilibrium(
  loadTon: number,
  cog: Vector3D,
  geoms: LegGeometryAndStiffness[]
): {
  tensions: number[];
  shares: number[];
  insideSupport: boolean;
  eccentricityM: number;
} {
  const p1 = geoms[0].lowerPos;
  const p2 = geoms[1].lowerPos;
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) {
    return {
      tensions: [loadTon / (2 * Math.max(1e-4, geoms[0].unitVec.y)), loadTon / (2 * Math.max(1e-4, geoms[1].unitVec.y))],
      shares: [loadTon / 2, loadTon / 2],
      insideSupport: false,
      eccentricityM: Math.hypot(cog.x - p1.x, cog.z - p1.z),
    };
  }
  const ux = dx / dist;
  const uz = dz / dist;
  const t = ((cog.x - p1.x) * ux + (cog.z - p1.z) * uz) / dist;
  const perpOffset = Math.abs((cog.x - p1.x) * -uz + (cog.z - p1.z) * ux);
  const insideSupport = t >= -1e-6 && t <= 1 + 1e-6 && perpOffset <= 0.5;

  const f2y = loadTon * t;
  const f1y = loadTon - f2y;
  const T1 = geoms[0].unitVec.y > 1e-4 ? Math.max(0, f1y) / geoms[0].unitVec.y : Infinity;
  const T2 = geoms[1].unitVec.y > 1e-4 ? Math.max(0, f2y) / geoms[1].unitVec.y : Infinity;
  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;

  return {
    tensions: [T1, T2],
    shares: [f1y, f2y],
    insideSupport,
    eccentricityM: Math.hypot(cog.x - midX, cog.z - midZ),
  };
}

/**
 * Determinate 3-leg spatial equilibrium:
 * Attempts direct 3D vector equilibrium [u1 u2 u3] * T = [0, W, 0]^T first when hook aligns with CoG,
 * and falls back to exact 2D planar moment-weighted distribution if hook has off-axis eccentricity.
 */
function solveThreeLegDeterminate(
  loadTon: number,
  cog: Vector3D,
  geoms: LegGeometryAndStiffness[]
): {
  tensions: number[];
  shares: number[];
  insideSupport: boolean;
  eccentricityM: number;
  slackIndices: number[];
  converged: boolean;
} {
  const insideSupport = pointInConvexHull2D(
    cog.x,
    cog.z,
    geoms.map((g) => g.lowerPos)
  );
  const avgX = geoms.reduce((s, g) => s + g.lowerPos.x, 0) / 3;
  const avgZ = geoms.reduce((s, g) => s + g.lowerPos.z, 0) / 3;
  const eccentricityM = Math.hypot(cog.x - avgX, cog.z - avgZ);

  // Solve 3x3 force equilibrium U * T = [0, W, 0]^T
  const U = [
    [geoms[0].unitVec.x, geoms[1].unitVec.x, geoms[2].unitVec.x],
    [geoms[0].unitVec.y, geoms[1].unitVec.y, geoms[2].unitVec.y],
    [geoms[0].unitVec.z, geoms[1].unitVec.z, geoms[2].unitVec.z],
  ];
  const solvedT = solveLinearSystem(U, [0, loadTon, 0]);

  if (solvedT && solvedT.every((t) => Number.isFinite(t))) {
    const slackIndices = solvedT.map((t, idx) => (t < -1e-4 ? idx : -1)).filter((i) => i >= 0);
    if (slackIndices.length === 0) {
      const clampedPos = solvedT.map((t) => Math.max(0, t));
      return {
        tensions: clampedPos,
        shares: clampedPos.map((t, idx) => t * geoms[idx].unitVec.y),
        insideSupport,
        eccentricityM,
        slackIndices: [],
        converged: true,
      };
    }

    // Active-set drop: if 1 leg wants compression (<0), set it slack=0 and test active 2-leg pair!
    if (slackIndices.length === 1) {
      const droppedIdx = slackIndices[0];
      const remGeoms = geoms.filter((_, idx) => idx !== droppedIdx);
      const twoSolve = solveTwoLegPlanarEquilibrium(loadTon, cog, remGeoms);
      const fullT = [0, 0, 0];
      const fullShares = [0, 0, 0];
      remGeoms.forEach((rg, pos) => {
        fullT[rg.index] = twoSolve.tensions[pos];
        fullShares[rg.index] = twoSolve.shares[pos];
      });
      return {
        tensions: fullT,
        shares: fullShares,
        insideSupport: insideSupport && twoSolve.insideSupport,
        eccentricityM,
        slackIndices: [droppedIdx],
        converged: twoSolve.insideSupport,
      };
    }
  }

  // Fallback exact vertical moment-balanced share if directions degenerate (collinear)
  const pts = geoms.map((g) => g.lowerPos);
  const det =
    (pts[0].x - pts[2].x) * (pts[1].z - pts[2].z) - (pts[1].x - pts[2].x) * (pts[0].z - pts[2].z);
  if (Math.abs(det) > 1e-8) {
    const l1 =
      ((pts[1].z - pts[2].z) * (cog.x - pts[2].x) + (pts[2].x - pts[1].x) * (cog.z - pts[2].z)) / det;
    const l2 =
      ((pts[2].z - pts[0].z) * (cog.x - pts[2].x) + (pts[0].x - pts[2].x) * (cog.z - pts[2].z)) / det;
    const l3 = 1 - l1 - l2;
    const shares = [loadTon * l1, loadTon * l2, loadTon * l3];
    const slackIndices = shares.map((s, idx) => (s < -1e-4 ? idx : -1)).filter((i) => i >= 0);
    const tensions = shares.map((s, idx) =>
      s > 0 && geoms[idx].unitVec.y > 1e-4 ? s / geoms[idx].unitVec.y : 0
    );
    return {
      tensions,
      shares,
      insideSupport: insideSupport && slackIndices.length === 0,
      eccentricityM,
      slackIndices,
      converged: slackIndices.length === 0,
    };
  }

  return {
    tensions: [0, 0, 0],
    shares: [0, 0, 0],
    insideSupport: false,
    eccentricityM,
    slackIndices: [0, 1, 2],
    converged: false,
  };
}

/**
 * Stiffness Matrix Compatibility Solver with Nonlinear Tension-Only Active-Set Iteration
 * Handles single-hook 3-DOF lifts AND multi-pick Spreader/Lifting Beam 6-DOF lifts.
 */
function solveStiffnessCompatibilityActiveSet(
  loadTon: number,
  cog: Vector3D,
  geoms: LegGeometryAndStiffness[],
  singleHookPoint: boolean
): {
  tensions: number[];
  elongationsMm: number[];
  slackIndices: number[];
  converged: boolean;
  insideSupport: boolean;
} {
  const n = geoms.length;
  const active = Array<boolean>(n).fill(true);
  let tensions = Array<number>(n).fill(0);
  let elongationsMm = Array<number>(n).fill(0);
  let converged = false;

  const insideSupport = pointInConvexHull2D(
    cog.x,
    cog.z,
    geoms.map((g) => g.lowerPos)
  );

  for (let iter = 0; iter < n + 2; iter++) {
    const activeCount = active.filter(Boolean).length;
    if (activeCount === 0) break;

    if (singleHookPoint) {
      // 3-DOF Translational Compatibility: K3 * s = [0, W, 0]^T + sum(k_i * dL_i * u_i)
      const K3 = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const rhs = [0, loadTon, 0];

      for (let i = 0; i < n; i++) {
        if (!active[i]) continue;
        const g = geoms[i];
        const k = g.stiffnessTonPerM!;
        const u = [g.unitVec.x, g.unitVec.y, g.unitVec.z];
        const pre = g.input.preTensionTon ?? 0;
        for (let r = 0; r < 3; r++) {
          rhs[r] += k * g.toleranceM * u[r] - pre * u[r];
          for (let c = 0; c < 3; c++) {
            K3[r][c] += k * u[r] * u[c];
          }
        }
      }

      // If planar (e.g. Z all 0), add tiny regularization only to completely unexcited orthogonal DOF
      if (Math.abs(K3[0][0]) < 1e-9) K3[0][0] = 1e-6;
      if (Math.abs(K3[2][2]) < 1e-9) K3[2][2] = 1e-6;

      const disp = solveLinearSystem(K3, rhs);
      if (!disp) {
        converged = false;
        break;
      }

      const trialTensions = Array<number>(n).fill(0);
      const trialElongMm = Array<number>(n).fill(0);
      let mostNegativeIdx = -1;
      let mostNegativeVal = -1e-5;

      for (let i = 0; i < n; i++) {
        const g = geoms[i];
        const k = g.stiffnessTonPerM!;
        const dotDisp = g.unitVec.x * disp[0] + g.unitVec.y * disp[1] + g.unitVec.z * disp[2];
        const elongM = dotDisp - g.toleranceM;
        trialElongMm[i] = elongM * 1000;
        if (!active[i]) {
          trialTensions[i] = 0;
          continue;
        }
        const ti = k * elongM + (g.input.preTensionTon ?? 0);
        trialTensions[i] = ti;
        if (ti < mostNegativeVal) {
          mostNegativeVal = ti;
          mostNegativeIdx = i;
        }
      }

      if (mostNegativeIdx >= 0) {
        // Unilateral tension-only contact: drop most compressive leg and re-solve
        active[mostNegativeIdx] = false;
        continue;
      }

      tensions = trialTensions.map((t, i) => (active[i] ? Math.max(0, t) : 0));
      elongationsMm = trialElongMm.map((e, i) => (active[i] ? e : Math.min(0, e)));
      converged = true;
      break;
    } else {
      // 6-DOF Full Rigid Body Stiffness Matrix for Multi-Pick / Spreader / Lifting Beam
      const K6 = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
      const rhs6 = [0, loadTon, 0, 0, 0, 0];

      for (let i = 0; i < n; i++) {
        if (!active[i]) continue;
        const g = geoms[i];
        const k = g.stiffnessTonPerM!;
        const rx = g.lowerPos.x - cog.x;
        const ry = g.lowerPos.y - cog.y;
        const rz = g.lowerPos.z - cog.z;
        const ux = g.unitVec.x;
        const uy = g.unitVec.y;
        const uz = g.unitVec.z;
        const bVec = [
          ux,
          uy,
          uz,
          ry * uz - rz * uy,
          rz * ux - rx * uz,
          rx * uy - ry * ux,
        ];
        const pre = g.input.preTensionTon ?? 0;
        for (let r = 0; r < 6; r++) {
          rhs6[r] += k * g.toleranceM * bVec[r] - pre * bVec[r];
          for (let c = 0; c < 6; c++) {
            K6[r][c] += k * bVec[r] * bVec[c];
          }
        }
      }

      // Check zero diagonal DOFs (e.g., pure vertical spreader doesn't resist YAW My)
      for (let d = 0; d < 6; d++) {
        if (Math.abs(K6[d][d]) < 1e-9 && Math.abs(rhs6[d]) < 1e-9) {
          K6[d][d] = 1e-6;
        }
      }

      const disp6 = solveLinearSystem(K6, rhs6);
      if (!disp6) {
        converged = false;
        break;
      }

      const trialTensions = Array<number>(n).fill(0);
      const trialElongMm = Array<number>(n).fill(0);
      let mostNegativeIdx = -1;
      let mostNegativeVal = -1e-5;

      for (let i = 0; i < n; i++) {
        const g = geoms[i];
        const k = g.stiffnessTonPerM!;
        const rx = g.lowerPos.x - cog.x;
        const ry = g.lowerPos.y - cog.y;
        const rz = g.lowerPos.z - cog.z;
        const ux = g.unitVec.x;
        const uy = g.unitVec.y;
        const uz = g.unitVec.z;
        const bVec = [
          ux,
          uy,
          uz,
          ry * uz - rz * uy,
          rz * ux - rx * uz,
          rx * uy - ry * ux,
        ];
        const elongM = bVec.reduce((s, bi, idx) => s + bi * disp6[idx], 0) - g.toleranceM;
        trialElongMm[i] = elongM * 1000;
        if (!active[i]) {
          trialTensions[i] = 0;
          continue;
        }
        const ti = k * elongM + (g.input.preTensionTon ?? 0);
        trialTensions[i] = ti;
        if (ti < mostNegativeVal) {
          mostNegativeVal = ti;
          mostNegativeIdx = i;
        }
      }

      if (mostNegativeIdx >= 0) {
        active[mostNegativeIdx] = false;
        continue;
      }

      tensions = trialTensions.map((t, i) => (active[i] ? Math.max(0, t) : 0));
      elongationsMm = trialElongMm.map((e, i) => (active[i] ? e : Math.min(0, e)));
      converged = true;
      break;
    }
  }

  const slackIndices = active.map((isAct, idx) => (!isAct || tensions[idx] <= 1e-4 ? idx : -1)).filter((i) => i >= 0);

  return {
    tensions,
    elongationsMm,
    slackIndices,
    converged,
    insideSupport,
  };
}

export interface StaticEquilibriumSolveParams {
  arrangementType?: SlingArrangementType;
  loadAtSlingsTon: number;
  cog: Vector3D;
  hookPos: Vector3D;
  points: AttachmentPointInput[];
  hitchType: 'VERTICAL' | 'CHOKER' | 'BASKET';
  hasEqualizer?: boolean;
  equalizerPairs?: Array<[string, string]>;
  enforceThreeLegEffectiveForFourLeg?: boolean;
  slingWllTon?: number | null;
  shackleEffectiveWllTon?: number | null;
  shackleLateralAngleDeg?: number;
  minAllowedAngleDeg?: number;
}

export interface StaticEquilibriumSolveOutput {
  arrangementType: SlingArrangementType;
  legs: SlingLegResult[];
  governingLegTensionTon: number;
  maxTensionRaw: number;
  minHorizAngleRaw: number;
  maxAngleFactorRaw: number;
  effectiveLegCount: number;
  cogInsideSupportPolygon: boolean;
  eccentricityM: number;
  overturningMomentTonM: number;
  staticEquilibrium: StaticEquilibriumReport;
  assumptions: EngineeringAssumption[];
  blockers: string[];
  warnings: string[];
}

export function solveRiggingStaticSystem(params: StaticEquilibriumSolveParams): StaticEquilibriumSolveOutput {
  const {
    loadAtSlingsTon,
    cog,
    hookPos,
    points,
    hitchType,
    hasEqualizer = false,
    equalizerPairs,
    enforceThreeLegEffectiveForFourLeg = false,
    slingWllTon,
    shackleEffectiveWllTon,
    shackleLateralAngleDeg = 0,
    minAllowedAngleDeg = 45,
  } = params;

  const arrangementType = inferArrangementType(params.arrangementType, points);
  const hitchMultiplier = hitchType === 'CHOKER' ? 0.75 : hitchType === 'BASKET' ? 1.8 : 1.0;
  const shackleSide = getShackleAngularDerating(shackleLateralAngleDeg);
  const assumptions: EngineeringAssumption[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Pre-compute 3D Geometry + Mechanical Stiffness for every leg
  const geoms: LegGeometryAndStiffness[] = points.map((pt, index) => {
    const upperPos = pt.upperPosition || hookPos;
    const dx = upperPos.x - pt.position.x;
    const dy = upperPos.y - pt.position.y;
    const dz = upperPos.z - pt.position.z;
    const geomLengthM = Math.hypot(dx, dy, dz);
    const safeL = Math.max(1e-6, geomLengthM);
    const tolM = Number.isFinite(pt.lengthToleranceMm) ? (pt.lengthToleranceMm || 0) / 1000 : 0;
    const effectiveLengthM = Math.max(1e-6, geomLengthM + tolM);

    const ux = dx / safeL;
    const uy = dy / safeL;
    const uz = dz / safeL;
    const sinClamped = Math.min(1, Math.max(-1, uy));
    const horizontalAngleDeg = (Math.asin(sinClamped) * 180) / Math.PI;
    const verticalAngleDeg = 90 - horizontalAngleDeg;
    const angleFactor = uy > 1e-4 ? 1 / uy : Infinity;

    const stiff = deriveLegStiffness(pt, effectiveLengthM);

    if (pt.diameterMm && pt.elasticModulusGpa && !pt.metallicAreaMm2 && pt.materialType === 'WIRE_ROPE') {
      assumptions.push({
        id: `ASM_AREA_${pt.id}`,
        category: 'STIFFNESS',
        statementFa: `سطح مقطع فلزی سیم‌بکسل «${pt.label}» از قطر ${pt.diameterMm}mm با ضریب پرشدگی استاندارد ۰.۵۸ برآورد شده است.`,
        technicalBasis: 'Wire Rope IWRC Metallic Fill Factor ≈ 0.58 (ASME B30.9)',
        impactLevel: 'LOW',
        requiresEngineerSignoff: false,
      });
    }

    return {
      index,
      input: pt,
      lowerPos: pt.position,
      upperPos,
      geomLengthM,
      effectiveLengthM,
      toleranceM: tolM,
      unitVec: { x: ux, y: uy, z: uz },
      horizontalAngleDeg,
      verticalAngleDeg,
      angleFactor,
      stiffnessTonPerM: stiff.stiffnessTonPerM,
      axialStiffnessEaKn: stiff.eaKn,
      hasValidStiffness: stiff.valid,
      missingStiffnessReasons: stiff.missingReasons,
    };
  });

  const n = geoms.length;
  const singleHookPoint = geoms.every(
    (g) =>
      Math.hypot(g.upperPos.x - hookPos.x, g.upperPos.y - hookPos.y, g.upperPos.z - hookPos.z) < 1e-4
  );

  // Assemble full 6xN equilibrium matrix A
  const Aeq = Array.from({ length: 6 }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    const g = geoms[i];
    const rx = g.lowerPos.x - cog.x;
    const ry = g.lowerPos.y - cog.y;
    const rz = g.lowerPos.z - cog.z;
    Aeq[0][i] = g.unitVec.x;
    Aeq[1][i] = g.unitVec.y;
    Aeq[2][i] = g.unitVec.z;
    Aeq[3][i] = ry * g.unitVec.z - rz * g.unitVec.y;
    Aeq[4][i] = rz * g.unitVec.x - rx * g.unitVec.z;
    Aeq[5][i] = rx * g.unitVec.y - ry * g.unitVec.x;
  }

  const independentEqCount = computeMatrixRank(Aeq);
  const eqPairsCount = hasEqualizer
    ? equalizerPairs && equalizerPairs.length > 0
      ? equalizerPairs.length
      : Math.floor(n / 2)
    : 0;
  const rawIndeterminacy = Math.max(0, n - independentEqCount);
  const degreeOfIndeterminacy = Math.max(0, rawIndeterminacy - eqPairsCount);

  const stiffnessDataComplete = geoms.length > 0 && geoms.every((g) => g.hasValidStiffness);
  const missingDataFields = Array.from(new Set(geoms.flatMap((g) => g.missingStiffnessReasons)));

  const { symmetricGeometry, symmetricLoading } = checkGeometrySymmetry(geoms, cog);
  const centroidX = n > 0 ? geoms.reduce((s, g) => s + g.lowerPos.x, 0) / n : 0;
  const centroidZ = n > 0 ? geoms.reduce((s, g) => s + g.lowerPos.z, 0) / n : 0;
  const cogEccentricityM = Math.hypot(cog.x - centroidX, cog.z - centroidZ);
  const overturningMomentTonM = roundDisplay(loadAtSlingsTon * cogEccentricityM, 3);

  let determinacyClassification: DeterminacyClassification = 'DETERMINATE';
  let solutionMethod: StaticSolutionMethod = 'STATIC_EQUILIBRIUM_EXACT';
  let tensions = Array<number>(n).fill(0);
  let elongationsMm: Array<number | null> = Array<number | null>(n).fill(null);
  let slackIndices: number[] = [];
  let droppedEnvelopeIndices: number[] = [];
  let cogInsidePolygon = true;
  let compatibilityVerified = true;
  let diagnosisFa = '';

  if (n === 0) {
    determinacyClassification = 'UNDERCONSTRAINED';
    solutionMethod = 'INSUFFICIENT_DATA_NOT_VERIFIED';
    cogInsidePolygon = false;
    compatibilityVerified = false;
    diagnosisFa = 'هیچ نقطه آویز یا شاخه اسلینگ تعریف نشده است.';
    blockers.push(diagnosisFa);
  } else if (n === 1) {
    // Statically Determinate Single-Leg
    determinacyClassification = 'DETERMINATE';
    solutionMethod = 'STATIC_EQUILIBRIUM_EXACT';
    const ecc = Math.hypot(cog.x - geoms[0].lowerPos.x, cog.z - geoms[0].lowerPos.z);
    cogInsidePolygon = ecc <= 0.5;
    tensions = [geoms[0].unitVec.y > 1e-4 ? loadAtSlingsTon / geoms[0].unitVec.y : Infinity];
    diagnosisFa = 'سیستم تک‌شاخه استاتیکی معین است؛ کشش مستقیم مطابق تعادل قائم محاسبه شد.';
  } else if (n === 2) {
    // Two-Leg Determinate Planar Equilibrium
    determinacyClassification = 'DETERMINATE';
    solutionMethod = 'STATIC_EQUILIBRIUM_EXACT';
    const res2 = solveTwoLegPlanarEquilibrium(loadAtSlingsTon, cog, geoms);
    tensions = res2.tensions;
    cogInsidePolygon = res2.insideSupport;
    slackIndices = res2.shares.map((v, i) => (v <= 1e-4 ? i : -1)).filter((i) => i >= 0);
    diagnosisFa = 'سیستم دو شاخه (یا Bridle دو نقطه‌ای) از نظر استاتیکی معین است و توزیع بار بر اساس تعادل گشتاور واقعی حول مرکز ثقل تعیین شد.';
  } else if (n === 3 || degreeOfIndeterminacy === 0) {
    if (n === 3 && singleHookPoint) {
      determinacyClassification = 'DETERMINATE';
      solutionMethod = 'STATIC_EQUILIBRIUM_EXACT';
      const res3 = solveThreeLegDeterminate(loadAtSlingsTon, cog, geoms);
      tensions = res3.tensions;
      cogInsidePolygon = res3.insideSupport;
      slackIndices = res3.slackIndices;
      diagnosisFa =
        slackIndices.length > 0
          ? `سیستم ۳ شاخه معین است، اما شاخه (${slackIndices.map((i) => geoms[i].input.label).join('، ')}) فاقد کشش مؤثر (Slack) است.`
          : 'سیستم ۳ شاخه غیرهم‌خط استاتیکی معین است (۳ مجهول و ۳ معادله مستقل تعادل بدون نیاز به فرض سختی).';
    } else if (eqPairsCount > 0) {
      // Equalizer reduced indeterminacy to determinate!
      determinacyClassification = 'EQUALIZER_REDUCED';
      solutionMethod = 'EQUALIZER_BALANCED_EQUILIBRIUM';
      // Pair adjacent legs or explicit pairs into equivalent centroidal picks
      const pairs: Array<[number, number]> = [];
      if (equalizerPairs && equalizerPairs.length > 0) {
        for (const [idA, idB] of equalizerPairs) {
          const iA = geoms.findIndex((g) => g.input.id === idA);
          const iB = geoms.findIndex((g) => g.input.id === idB);
          if (iA >= 0 && iB >= 0 && iA !== iB) pairs.push([iA, iB]);
        }
      }
      if (pairs.length === 0) {
        for (let i = 0; i + 1 < n; i += 2) pairs.push([i, i + 1]);
      }
      const pairedMidPoints: AttachmentPointInput[] = pairs.map(([a, b], idx) => ({
        id: `EQ_${idx + 1}`,
        label: `Equalizer Pair ${geoms[a].input.id}-${geoms[b].input.id}`,
        position: {
          x: (geoms[a].lowerPos.x + geoms[b].lowerPos.x) / 2,
          y: (geoms[a].lowerPos.y + geoms[b].lowerPos.y) / 2,
          z: (geoms[a].lowerPos.z + geoms[b].lowerPos.z) / 2,
        },
        upperPosition: {
          x: (geoms[a].upperPos.x + geoms[b].upperPos.x) / 2,
          y: (geoms[a].upperPos.y + geoms[b].upperPos.y) / 2,
          z: (geoms[a].upperPos.z + geoms[b].upperPos.z) / 2,
        },
      }));
      const midGeoms: LegGeometryAndStiffness[] = pairedMidPoints.map((mp, idx) => {
        const dx = mp.upperPosition!.x - mp.position.x;
        const dy = mp.upperPosition!.y - mp.position.y;
        const dz = mp.upperPosition!.z - mp.position.z;
        const len = Math.max(1e-6, Math.hypot(dx, dy, dz));
        return {
          index: idx,
          input: mp,
          lowerPos: mp.position,
          upperPos: mp.upperPosition!,
          geomLengthM: len,
          effectiveLengthM: len,
          toleranceM: 0,
          unitVec: { x: dx / len, y: dy / len, z: dz / len },
          horizontalAngleDeg: (Math.asin(Math.min(1, Math.max(-1, dy / len))) * 180) / Math.PI,
          verticalAngleDeg: 90 - (Math.asin(Math.min(1, Math.max(-1, dy / len))) * 180) / Math.PI,
          angleFactor: dy / len > 1e-4 ? len / dy : Infinity,
          stiffnessTonPerM: null,
          axialStiffnessEaKn: null,
          hasValidStiffness: false,
          missingStiffnessReasons: [],
        };
      });
      cogInsidePolygon = pointInConvexHull2D(
        cog.x,
        cog.z,
        geoms.map((g) => g.lowerPos)
      );
      if (midGeoms.length === 2) {
        const eq2 = solveTwoLegPlanarEquilibrium(loadAtSlingsTon, cog, midGeoms);
        pairs.forEach(([a, b], pIdx) => {
          // True pulley / equalizer equalizes axial tension Ta = Tb = T_pair
          const sumUy = geoms[a].unitVec.y + geoms[b].unitVec.y;
          const tPair = sumUy > 1e-4 ? Math.max(0, eq2.shares[pIdx]) / sumUy : Infinity;
          tensions[a] = tPair;
          tensions[b] = tPair;
        });
      }
      assumptions.push({
        id: 'ASM_EQUALIZER',
        category: 'EQUILIBRIUM',
        statementFa: `تجهیز متعادل‌کننده (Equalizer / Sheave) زوج شاخه‌ها را هم‌تنش می‌کند (درجه نامعینی از ${rawIndeterminacy} به ${degreeOfIndeterminacy} کاهش یافت).`,
        technicalBasis: 'Equalizer Beam / Pulley Equilibrium (Ta = Tb)',
        impactLevel: 'MEDIUM',
        requiresEngineerSignoff: true,
      });
      diagnosisFa = 'توزیع بار با استفاده از مکانیزم Equalizer متعادل و به سیستم معین تبدیل شد.';
    } else if (stiffnessDataComplete) {
      // Multi-pick spreader/lifting beam with valid stiffness and full 6-DOF rank
      determinacyClassification = 'INDETERMINATE';
      solutionMethod = 'STIFFNESS_COMPATIBILITY_ACTIVE_SET';
      const solved = solveStiffnessCompatibilityActiveSet(loadAtSlingsTon, cog, geoms, singleHookPoint);
      tensions = solved.tensions;
      elongationsMm = solved.elongationsMm;
      slackIndices = solved.slackIndices;
      cogInsidePolygon = solved.insideSupport;
      compatibilityVerified = solved.converged;
      diagnosisFa = 'حل سیستم با روش ماتریس سختی و سازگاری تغییرشکل ۶ درجه آزادی انجام شد.';
    } else {
      determinacyClassification = 'INDETERMINATE';
      solutionMethod = 'INSUFFICIENT_DATA_NOT_VERIFIED';
      cogInsidePolygon = pointInConvexHull2D(
        cog.x,
        cog.z,
        geoms.map((g) => g.lowerPos)
      );
      compatibilityVerified = false;
      diagnosisFa =
        'سیستم به دلیل نبود اطلاعات سختی یا آرایش نامعین غیرمتصل به یک قلاب، بدون داده‌های تکمیلی قابل حل قطعی نیست.';
    }
  } else {
    // Statically Indeterminate (e.g., 4-leg or multi-leg sling without Equalizer)
    determinacyClassification = 'INDETERMINATE';
    cogInsidePolygon = pointInConvexHull2D(
      cog.x,
      cog.z,
      geoms.map((g) => g.lowerPos)
    );

    if (stiffnessDataComplete) {
      solutionMethod = 'STIFFNESS_COMPATIBILITY_ACTIVE_SET';
      const solved = solveStiffnessCompatibilityActiveSet(loadAtSlingsTon, cog, geoms, singleHookPoint);
      tensions = solved.tensions;
      elongationsMm = solved.elongationsMm;
      slackIndices = solved.slackIndices;
      compatibilityVerified = solved.converged;

      if (!solved.converged) {
        blockers.push('ماتریس سختی سیستم در حالت کشش خالص (Active-Set) همگرا نشد یا مکانیزم ناپایدار تشکیل شد.');
      }
      if (slackIndices.length > 0) {
        const slackLabels = slackIndices.map((i) => geoms[i].input.label).join('، ');
        warnings.push(
          `در تحلیل سازگاری تغییرشکل، شاخه(های) «${slackLabels}» به علت اختلاف طول مؤثر یا برون‌محوری CoG فاقد کشش (Slack = 0 t) تشخیص داده شدند.`
        );
      }

      // If ASME B30.9 rigid envelope is also requested alongside stiffness, note worst-case envelope
      assumptions.push({
        id: 'ASM_STIFFNESS_COMPAT',
        category: 'STIFFNESS',
        statementFa: `سیستم ${n}-شاخه نامعین استاتیکی (DSI=${degreeOfIndeterminacy}) با روش سختی و سازگاری تغییرشکل (K·Δ = F) و حذف شاخه‌های شل (Tension-Only) حل شد.`,
        technicalBasis: 'Matrix Stiffness & Deformation Compatibility Method (No equal W/4 assumption)',
        impactLevel: 'MEDIUM',
        requiresEngineerSignoff: false,
      });

      diagnosisFa =
        slackIndices.length > 0
          ? `سیستم ${n}-شاخه نامعین با روش سختی حل شد؛ فقط ${n - slackIndices.length} شاخه مشارکت فعال دارند و ${slackIndices.length} شاخه شل (Slack) هستند.`
          : `سیستم ${n}-شاخه نامعین با روش سختی حل شد؛ هر ${n} شاخه با توزیع واقعی محاسبه‌شده مشارکت دارند.`;
    } else if (enforceThreeLegEffectiveForFourLeg && n === 4) {
      // ASME B30.9 / P30.1 Rigid Load 3-Leg Bounding Envelope (conservative fallback requested explicitly)
      solutionMethod = 'RIGID_SUBSET_ENVELOPE_UNVERIFIED';
      compatibilityVerified = false;
      let worstMaxT = -1;
      let worstTensions = [0, 0, 0, 0];
      let worstDrop = 0;

      for (let drop = 0; drop < 4; drop++) {
        const subGeoms = geoms.filter((_, idx) => idx !== drop).map((g, subIdx) => ({ ...g, index: subIdx }));
        const sub3 = solveThreeLegDeterminate(loadAtSlingsTon, cog, subGeoms);
        const maxSubT = Math.max(...sub3.tensions.filter(Number.isFinite));
        if (maxSubT > worstMaxT) {
          worstMaxT = maxSubT;
          worstDrop = drop;
          worstTensions = [0, 0, 0, 0];
          subGeoms.forEach((sg, pos) => {
            const origIdx = geoms.findIndex((og) => og.input.id === sg.input.id);
            if (origIdx >= 0) worstTensions[origIdx] = sub3.tensions[pos];
          });
        }
      }
      tensions = worstTensions;
      droppedEnvelopeIndices = [worstDrop];

      assumptions.push({
        id: 'ASM_INDET_NO_STIFFNESS',
        category: 'STIFFNESS',
        statementFa: `توزیع دقیق بار بین ${n} شاخه اسلینگ به دلیل نامعین بودن استاتیکی (DSI=${degreeOfIndeterminacy}) و نبود اطلاعات سختی مؤثر (EA / مدول و سطح مقطع) قابل تعیین قطعی نیست؛ پوش بحرانی ۳ شاخه مؤثر ASME B30.9 گزارش شد و وضعیت محاسبه NOT_VERIFIED باقی می‌ماند.`,
        technicalBasis: 'ASME B30.9 Rigid 3-Leg Bounding Envelope (Pending Stiffness / Equalizer Data)',
        impactLevel: 'HIGH',
        requiresEngineerSignoff: true,
      });

      warnings.push(
        `توزیع بار بین ${n} شاخه اسلینگ به دلیل نامعین بودن استاتیکی سیستم و نبود اطلاعات سختی مؤثر شاخه‌ها قابل تعیین قطعی نیست. ارائه مشخصات مکانیکی یا آرایش Equalizer و بررسی مهندسی تکمیلی الزامی است.`
      );
      diagnosisFa =
        'سیستم نامعین استاتیکی بدون مشخصات سختی شاخه‌ها: بدترین ترکیب ۳ شاخه ASME B30.9 محاسبه شد اما وضعیت تا ورود EA یا Equalizer در حالت NOT VERIFIED می‌ماند.';
    } else {
      // Strictly NOT VERIFIED: refuse to guess W/4!
      solutionMethod = 'INSUFFICIENT_DATA_NOT_VERIFIED';
      compatibilityVerified = false;
      tensions = Array<number>(n).fill(0);
      assumptions.push({
        id: 'ASM_REFUSE_W_DIV_N',
        category: 'STIFFNESS',
        statementFa: `توزیع بار بین ${n} شاخه اسلینگ به دلیل نامعین بودن استاتیکی سیستم (DSI=${degreeOfIndeterminacy}) و نبود اطلاعات سختی مؤثر شاخه‌ها قابل تعیین قطعی نیست. از تقسیم مساوی فرضی وزن (W/${n}) خودداری شد.`,
        technicalBasis: 'Engineering Mandate: Zero Unverified W/N Equal-Split Assumption',
        impactLevel: 'HIGH',
        requiresEngineerSignoff: true,
      });
      blockers.push(
        `توزیع بار بین ${n} شاخه اسلینگ به دلیل نامعین بودن استاتیکی سیستم و نبود اطلاعات سختی مؤثر شاخه‌ها قابل تعیین قطعی نیست. ارائه مشخصات مکانیکی (مدول الاستیسیته و سطح مقطع / سختی محوری EA) یا آرایش Equalizer الزامی است.`
      );
      diagnosisFa =
        'اطلاعات سختی شاخه‌ها برای حل سیستم استاتیکی نامعین ناقص است؛ سامانه از تقسیم مساوی فرضی بار خودداری کرد (NOT VERIFIED).';
    }
  }

  // Enforce zero compression strictly
  const noCompressionVerified = tensions.every((t) => !Number.isFinite(t) || t >= -1e-6);
  const nonNegativeTensions = tensions.map((t) => (Number.isFinite(t) ? Math.max(0, t) : Infinity));

  const residuals = compute6DofResiduals(
    nonNegativeTensions.map((t) => (Number.isFinite(t) ? t : 0)),
    geoms,
    loadAtSlingsTon,
    cog
  );

  // Check if pendulum horizontal hook-to-CoG misalignment causes force residual
  const hookCogHorizOffsetM = Math.hypot(hookPos.x - cog.x, hookPos.z - cog.z);
  if (singleHookPoint && hookCogHorizOffsetM > 0.05 && residuals.maxForceResidualTon > FORCE_RESIDUAL_TOL_TON) {
    warnings.push(
      `موقعیت افقی قلاب با مرکز ثقل بار ${roundDisplay(hookCogHorizOffsetM, 3)}m فاصله دارد؛ این عدم هم‌محوری موجب گشتاور نوسان/کج‌شدن بار در حین بلندکردن (خطای تعادل ${residuals.maxForceResidualTon} t) می‌شود.`
    );
  }

  if (!cogInsidePolygon) {
    blockers.push('مرکز ثقل (CoG) خارج از محدوده پایدار نقاط اتصال قرار دارد و باعث واژگونی یا بی‌باری شاخه‌ها می‌شود.');
  }

  // Build per-leg outputs
  const totalVerticalFromTensions = nonNegativeTensions.reduce(
    (s, t, i) => s + (Number.isFinite(t) ? t * geoms[i].unitVec.y : 0),
    0
  );
  const avgShare = totalVerticalFromTensions > 0 ? totalVerticalFromTensions / Math.max(1, n) : loadAtSlingsTon / Math.max(1, n);

  const legs: SlingLegResult[] = geoms.map((g, i) => {
    const T = nonNegativeTensions[i];
    const isFiniteT = Number.isFinite(T);
    const vShare = isFiniteT ? T * g.unitVec.y : 0;
    const isDropped = droppedEnvelopeIndices.includes(i);
    const isSlack = slackIndices.includes(i) || (!isDropped && solutionMethod !== 'INSUFFICIENT_DATA_NOT_VERIFIED' && isFiniteT && T <= 1e-4);

    let participationStatus: LegParticipationStatus = 'ACTIVE';
    if (solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED') {
      participationStatus = 'UNVERIFIED';
    } else if (isDropped) {
      participationStatus = 'DROPPED_RIGID_ENVELOPE';
    } else if (isSlack) {
      participationStatus = 'SLACK';
    } else if (vShare < avgShare * 0.65) {
      participationStatus = 'REDUCED_SHARE';
    }

    const legSlingBaseWll = g.input.customWllTon && g.input.customWllTon > 0 ? g.input.customWllTon : slingWllTon;
    const effectiveLegWll =
      legSlingBaseWll && legSlingBaseWll > 0 ? legSlingBaseWll * hitchMultiplier : null;
    const slingUtil =
      effectiveLegWll !== null && isFiniteT ? (T / effectiveLegWll) * 100 : null;
    const remSling =
      effectiveLegWll !== null && isFiniteT ? effectiveLegWll - T : null;

    const shackleUtil =
      shackleEffectiveWllTon && shackleEffectiveWllTon > 0 && isFiniteT
        ? (T / shackleEffectiveWllTon) * 100
        : null;
    const remShackle =
      shackleEffectiveWllTon && shackleEffectiveWllTon > 0 && isFiniteT
        ? shackleEffectiveWllTon - T
        : null;

    let legStatus: VerificationStatus = 'PASS';
    if (
      !cogInsidePolygon ||
      !isFiniteT ||
      g.horizontalAngleDeg < 30 ||
      (slingUtil !== null && slingUtil > 100) ||
      (shackleUtil !== null && shackleUtil > 100)
    ) {
      legStatus = 'FAIL';
    } else if (
      solutionMethod === 'INSUFFICIENT_DATA_NOT_VERIFIED' ||
      solutionMethod === 'RIGID_SUBSET_ENVELOPE_UNVERIFIED' ||
      (legSlingBaseWll == null && shackleEffectiveWllTon == null)
    ) {
      legStatus = 'NOT_VERIFIED';
    } else if (
      isSlack ||
      g.horizontalAngleDeg < minAllowedAngleDeg ||
      (slingUtil !== null && slingUtil > 85) ||
      (shackleUtil !== null && shackleUtil > 85) ||
      shackleSide.status === 'WARNING'
    ) {
      legStatus = 'WARNING';
    }

    return {
      id: g.input.id,
      label: g.input.label,
      attachmentPos: g.lowerPos,
      upperPos: g.upperPos,
      verticalShareTon: roundDisplay(vShare, 3),
      axialTensionTon: isFiniteT ? roundDisplay(T, 3) : 9999,
      forceVectorTon: {
        x: isFiniteT ? roundDisplay(T * g.unitVec.x, 3) : 0,
        y: isFiniteT ? roundDisplay(T * g.unitVec.y, 3) : 0,
        z: isFiniteT ? roundDisplay(T * g.unitVec.z, 3) : 0,
      },
      lengthM: roundDisplay(g.geomLengthM, 3),
      effectiveLengthM: roundDisplay(g.effectiveLengthM, 4),
      horizontalAngleDeg: roundDisplay(g.horizontalAngleDeg, 2),
      verticalAngleDeg: roundDisplay(g.verticalAngleDeg, 2),
      angleFactor: Number.isFinite(g.angleFactor) ? roundDisplay(g.angleFactor, 4) : 999,
      axialStiffnessKn: g.axialStiffnessEaKn !== null ? roundDisplay(g.axialStiffnessEaKn, 1) : null,
      axialElongationMm: elongationsMm[i] !== null ? roundDisplay(elongationsMm[i]!, 3) : null,
      lengthToleranceMm: g.input.lengthToleranceMm ?? 0,
      participationStatus,
      allowableWllTon: effectiveLegWll !== null ? roundDisplay(effectiveLegWll, 3) : null,
      slingUtilizationPct: slingUtil !== null ? roundDisplay(slingUtil, 2) : null,
      remainingSlingCapacityTon: remSling !== null ? roundDisplay(remSling, 3) : null,
      shackleUtilizationPct: shackleUtil !== null ? roundDisplay(shackleUtil, 2) : null,
      remainingShackleCapacityTon: remShackle !== null ? roundDisplay(remShackle, 3) : null,
      status: legStatus,
    };
  });

  const maxTensionRaw = nonNegativeTensions.reduce((m, t) => Math.max(m, Number.isFinite(t) ? t : m), 0);
  const minHorizAngleRaw = geoms.reduce((m, g) => Math.min(m, g.horizontalAngleDeg), 90);
  const maxAngleFactorRaw = geoms.reduce((m, g) => Math.max(m, Number.isFinite(g.angleFactor) ? g.angleFactor : m), 1);

  const activeLegCount = legs.filter(
    (l) => l.participationStatus === 'ACTIVE' || l.participationStatus === 'REDUCED_SHARE'
  ).length;
  const slackLegIds = legs.filter((l) => l.participationStatus === 'SLACK').map((l) => l.id);

  // Per Section 10: residual error beyond tolerance blocks PASS
  if (
    solutionMethod !== 'INSUFFICIENT_DATA_NOT_VERIFIED' &&
    solutionMethod !== 'RIGID_SUBSET_ENVELOPE_UNVERIFIED' &&
    !residuals.converged
  ) {
    warnings.push(
      `باقیمانده تعادل ۶ درجه آزادی (F_res=${residuals.maxForceResidualTon} t, M_res=${residuals.maxMomentResidualTonM} t·m) از تلورانس مهندسی فراتر رفته است.`
    );
  }

  return {
    arrangementType,
    legs,
    governingLegTensionTon: roundDisplay(maxTensionRaw, 3),
    maxTensionRaw,
    minHorizAngleRaw,
    maxAngleFactorRaw,
    effectiveLegCount:
      solutionMethod === 'RIGID_SUBSET_ENVELOPE_UNVERIFIED'
        ? Math.max(1, n - droppedEnvelopeIndices.length)
        : activeLegCount > 0
          ? activeLegCount
          : Math.min(3, n),
    cogInsideSupportPolygon: cogInsidePolygon,
    eccentricityM: cogEccentricityM,
    overturningMomentTonM,
    staticEquilibrium: {
      arrangementType,
      unknownCount: n,
      independentEquationsCount: independentEqCount,
      degreeOfIndeterminacy,
      determinacyClassification,
      solutionMethod,
      stiffnessDataComplete,
      compatibilityVerified,
      noCompressionVerified,
      activeLegCount,
      slackLegIds,
      symmetricGeometry,
      symmetricLoading,
      residuals,
      missingDataFields,
      diagnosisFa,
    },
    assumptions,
    blockers,
    warnings,
  };
}
