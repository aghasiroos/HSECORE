/**
 * Independent, Standards-Documented Fire Suppression Engineering Engine
 * References:
 *  - NFPA 13 (Editions 2016, 2019, 2022): Standard for the Installation of Sprinkler Systems
 *  - NFPA 10 (Editions 2018, 2022): Standard for Portable Fire Extinguishers
 *  - Hazen-Williams Hydraulic Friction Loss Equation (SI & US Customary)
 *
 * NOTE: All outputs are preliminary engineering calculations & decision-support data.
 * Final hydraulic balance, seismic bracing, and construction drawings require PE/AHJ review.
 */

import type {
  AgentCompatibilityDecision,
  AgentType,
  ComplianceCheckItem,
  CoverageCellStatus,
  CoverageMapCell,
  EquipmentComparisonRow,
  ExtinguisherConfigInput,
  FireClass,
  FireDesignBuilding,
  FireDesignFloor,
  FloorCalculationResult,
  FloorObstacle,
  HazardGroup,
  HydraulicCalculationResult,
  Nfpa10Edition,
  Nfpa13Edition,
  OccupancyType,
  PlacedSuppressionItem,
  SprinklerConfigInput,
  UncoveredZone,
} from './types';
import {
  resolveHasFirePump,
  resolveHasNetworkConnection,
  resolveWaterSourceType,
  toNullablePositiveNumber,
} from './waterSupplyUtils';

export const ENGINEERING_DISCLAIMER_FA =
  'سلب مسئولیت مهندسی: خروجی‌های این سامانه صرفاً ابزار طراحی مقدماتی و پشتیبان تصمیم (Decision Support) است و جایگزین محاسبات نهایی، تاییدیه مهندس ذی‌صلاح (PE) و مرجع تاییدکننده (AHJ / آتش‌نشانی) نمی‌باشد.';

export interface ExistingEquipmentSummaryItem {
  id: string;
  code: string;
  category: string;
  location: string;
  unit?: string;
  complex?: string;
  floor?: string;
  type?: string;
  weight?: number | string;
  operationalStatus?: string;
  nextInspectionDue?: string | null;
  hydrostaticTestDue?: string | null;
}

interface HazardTableSpec {
  group: HazardGroup;
  labelFa: string;
  maxAreaPerHeadSqm: number; // NFPA 13 Tables 10.2.4.2.1(a)-(c) / 8.6.2.2.1
  maxAreaPerHeadSqft: number;
  maxSpacingM: number;
  minSpacingM: number;
  designDensityGpmSqft: number; // NFPA 13 Fig. 19.3.3.1.1 / Table 19.2.3.1.1 (2022)
  remoteAreaSqft: number;
  hoseStreamGpm: number;
  durationMin: number;
  recommendedKFactor: number;
}

const NFPA13_HAZARD_SPECS: Record<HazardGroup, HazardTableSpec> = {
  LIGHT: {
    group: 'LIGHT',
    labelFa: 'خطر سبک (Light Hazard)',
    maxAreaPerHeadSqm: 18.6, // 200 ft2 (hydraulically calculated)
    maxAreaPerHeadSqft: 200,
    maxSpacingM: 4.6, // 15 ft
    minSpacingM: 1.8, // 6 ft
    designDensityGpmSqft: 0.10,
    remoteAreaSqft: 1500,
    hoseStreamGpm: 100,
    durationMin: 30,
    recommendedKFactor: 5.6,
  },
  OH1: {
    group: 'OH1',
    labelFa: 'خطر عادی گروه ۱ (Ordinary Hazard Group 1)',
    maxAreaPerHeadSqm: 12.1, // 130 ft2
    maxAreaPerHeadSqft: 130,
    maxSpacingM: 4.6, // 15 ft
    minSpacingM: 1.8,
    designDensityGpmSqft: 0.15,
    remoteAreaSqft: 1500,
    hoseStreamGpm: 250,
    durationMin: 60,
    recommendedKFactor: 5.6,
  },
  OH2: {
    group: 'OH2',
    labelFa: 'خطر عادی گروه ۲ (Ordinary Hazard Group 2)',
    maxAreaPerHeadSqm: 12.1, // 130 ft2
    maxAreaPerHeadSqft: 130,
    maxSpacingM: 4.6, // 15 ft
    minSpacingM: 1.8,
    designDensityGpmSqft: 0.20,
    remoteAreaSqft: 1500,
    hoseStreamGpm: 250,
    durationMin: 60,
    recommendedKFactor: 8.0,
  },
  EH1: {
    group: 'EH1',
    labelFa: 'خطر فوق‌العاده گروه ۱ (Extra Hazard Group 1)',
    maxAreaPerHeadSqm: 9.3, // 100 ft2
    maxAreaPerHeadSqft: 100,
    maxSpacingM: 3.7, // 12 ft
    minSpacingM: 1.8,
    designDensityGpmSqft: 0.30,
    remoteAreaSqft: 2500,
    hoseStreamGpm: 500,
    durationMin: 90,
    recommendedKFactor: 8.0,
  },
  EH2: {
    group: 'EH2',
    labelFa: 'خطر فوق‌العاده گروه ۲ (Extra Hazard Group 2)',
    maxAreaPerHeadSqm: 9.3, // 100 ft2
    maxAreaPerHeadSqft: 100,
    maxSpacingM: 3.7, // 12 ft
    minSpacingM: 1.8,
    designDensityGpmSqft: 0.40,
    remoteAreaSqft: 2500,
    hoseStreamGpm: 500,
    durationMin: 120,
    recommendedKFactor: 11.2,
  },
  SPECIAL_STORAGE: {
    group: 'SPECIAL_STORAGE',
    labelFa: 'انبارش مرتفع / خطر ویژه (High-Piled / Special Hazard)',
    maxAreaPerHeadSqm: 9.3, // 100 ft2 (ESFR/CMSA/Special)
    maxAreaPerHeadSqft: 100,
    maxSpacingM: 3.0, // 10 ft typical ESFR/High-Piled
    minSpacingM: 2.4, // 8 ft ESFR minimum
    designDensityGpmSqft: 0.45,
    remoteAreaSqft: 2500,
    hoseStreamGpm: 500,
    durationMin: 120,
    recommendedKFactor: 11.2,
  },
};

const PIPE_C_FACTORS: Record<string, number> = {
  BLACK_STEEL_WET: 120,
  BLACK_STEEL_DRY: 100,
  GALVANIZED: 120,
  CPVC_COPPER: 150,
};

export const OCCUPANCY_LABELS_FA: Record<OccupancyType, string> = {
  ADMINISTRATIVE: 'ساختمان اداری و ستادی',
  CONTROL_ROOM: 'اتاق کنترل مرکزی (Control Room)',
  SERVER_ROOM: 'اتاق سرور و مرکز داده (Server / DCS)',
  WAREHOUSE: 'انبار مواد و کالا',
  INDUSTRIAL_PROCESS: 'واحد فرآیندی و صنعتی پتروشیمی',
  LABORATORY: 'آزمایشگاه شیمیایی و کنترل کیفیت',
  KITCHEN_DINING: 'آشپزخانه صنعتی و رستوران',
  ELECTRICAL_SUBSTATION: 'پست برق و تابلوخانه (Substation)',
  WORKSHOP: 'کارگاه تعمیرات و مکانیک',
  PARKING: 'پارکینگ سرپوشیده',
  OTHER: 'سایر کاربری‌ها',
};

export const AGENT_LABELS_FA: Record<AgentType, string> = {
  ABC_DRY_POWDER: 'پودر شیمیایی خشک چندمنظوره (ABC)',
  CO2: 'دی‌اکسید کربن (CO2)',
  CLEAN_AGENT: 'گاز پاک (FM-200 / Halotron / FK-5-1-12)',
  FOAM_AFFF: 'فوم مکانیکی (AFFF / FFFP)',
  WATER: 'آب تحت فشار (Water)',
  WET_CHEMICAL: 'مواد شیمیایی مرطوب (Wet Chemical - Class K)',
  CLASS_D_POWDER: 'پودر تخصصی فلزات قابل اشتعال (Class D)',
};

export function getNfpa13TableCitation(edition: Nfpa13Edition): {
  spacingRef: string;
  densityRef: string;
  obstructionRef: string;
  hydraulicRef: string;
  editionNoteFa: string;
} {
  if (edition === '2016') {
    return {
      spacingRef: 'NFPA 13 (2016) Sec. 8.6.2 & Table 8.6.2.2.1(a)-(c)',
      densityRef: 'NFPA 13 (2016) Fig. 11.2.3.1.1 & Table 11.2.3.1.2',
      obstructionRef: 'NFPA 13 (2016) Sec. 8.6.5 (Three-Times Rule)',
      hydraulicRef: 'NFPA 13 (2016) Ch. 23 (Sec. 23.4.2.1 Hazen-Williams)',
      editionNoteFa: 'مبتنی بر ویرایش ۲۰۱۶: استفاده از منحنی‌های چگالی/مساحت فصل ۱۱ و جداول فواصل فصل ۸.',
    };
  }
  if (edition === '2019') {
    return {
      spacingRef: 'NFPA 13 (2019) Sec. 10.2.4 & Table 10.2.4.2.1(a)-(c)',
      densityRef: 'NFPA 13 (2019) Fig. 19.3.3.1.1 & Table 19.3.3.1.2',
      obstructionRef: 'NFPA 13 (2019) Sec. 10.2.6 (Beam & Obstruction Rules)',
      hydraulicRef: 'NFPA 13 (2019) Ch. 27 (Sec. 27.2.2 Hazen-Williams)',
      editionNoteFa: 'مبتنی بر ویرایش ۲۰۱۹: ساختار بازچینی‌شده فصل ۱۰ (جانمایی اسپرینکلر) و فصل ۱۹ (نیاز آبی).',
    };
  }
  return {
    spacingRef: 'NFPA 13 (2022) Sec. 10.2.4 & Table 10.2.4.2.1(a)-(c)',
    densityRef: 'NFPA 13 (2022) Sec. 19.2.3.1 & Table 19.2.3.1.1 (Single-Point Density/Area)',
    obstructionRef: 'NFPA 13 (2022) Sec. 10.2.6 (Three-Times Rule & Obstructions)',
    hydraulicRef: 'NFPA 13 (2022) Ch. 28 (Sec. 28.2.2 Hazen-Williams)',
    editionNoteFa:
      'مبتنی بر ویرایش ۲۰۲۲: حذف منحنی‌های قدیمی و به‌کارگیری نقاط طراحی تک‌نقطه‌ای جدول 19.2.3.1.1 و ضوابط فصل ۱۰.',
  };
}

export function getNfpa10TableCitation(edition: Nfpa10Edition): {
  classARef: string;
  classBRef: string;
  compatibilityRef: string;
  editionNoteFa: string;
} {
  if (edition === '2018') {
    return {
      classARef: 'NFPA 10 (2018) Table 6.2.1.1 (75 ft / 22.9 m Max Travel)',
      classBRef: 'NFPA 10 (2018) Table 6.3.1.1 (30-50 ft / 9.15-15.25 m Max Travel)',
      compatibilityRef: 'NFPA 10 (2018) Ch. 5 (Sec. 5.5 Selection for Specific Hazards)',
      editionNoteFa: 'مبتنی بر NFPA 10 ویرایش ۲۰۱۸: ضوابط فصل ۵ انتخاب عامل اطفا و جداول فصل ۶.',
    };
  }
  return {
    classARef: 'NFPA 10 (2022) Table 6.2.1.1 (75 ft / 22.9 m Max Travel)',
    classBRef: 'NFPA 10 (2022) Table 6.3.1.1 (30-50 ft / 9.15-15.25 m Max Travel)',
    compatibilityRef: 'NFPA 10 (2022) Ch. 5 (Sec. 5.5 Electronic/Clean Agent & D-Class Rules)',
    editionNoteFa: 'مبتنی بر NFPA 10 ویرایش ۲۰۲۲: تاکید تشدیدشده بر تجهیزات الکترونیکی حساس، باتری/فلزات و Class K.',
  };
}

/**
 * Validates whether required building & floor engineering inputs exist before emitting definitive calculations.
 */
export function validateInputsForCalculation(
  building: Partial<FireDesignBuilding> | null | undefined,
  floor: Partial<FireDesignFloor> | null | undefined
): {
  isComplete: boolean;
  missingRequiredFields: string[];
  missingWaterFields: string[];
} {
  const missingRequiredFields: string[] = [];
  const missingWaterFields: string[] = [];

  if (!building) {
    missingRequiredFields.push('اطلاعات پایه ساختمان');
  } else {
    if (!building.name?.trim()) missingRequiredFields.push('نام ساختمان');
    if (!building.code?.trim()) missingRequiredFields.push('کد ساختمان');
    if (!building.unitName?.trim()) missingRequiredFields.push('واحد بهره‌بردار');
    if (!building.occupancyType) missingRequiredFields.push('نوع کاربری ساختمان');
    if (!building.structureType) missingRequiredFields.push('نوع سازه');
    if (!building.ceilingType) missingRequiredFields.push('نوع سقف');
    if (!building.storedMaterials?.trim()) missingRequiredFields.push('نوع مواد و محصولات موجود');
    if (!building.activityType?.trim()) missingRequiredFields.push('نوع فعالیت در ساختمان');
    if (!Array.isArray(building.hazardNature) || building.hazardNature.length === 0) {
      missingRequiredFields.push('ماهیت خطر حریق (حداقل یک کلاس A/B/C/D/K)');
    }

    const ws = building.waterSupply || {};
    const isLegacyUnavailable = ws.isAvailable === false && !building.waterSourceType && !ws.sourceType;
    if (!isLegacyUnavailable) {
      const sourceType = resolveWaterSourceType(building, 'STORAGE_TANK');
      const hasPumpFlag = resolveHasFirePump(ws);
      const hasNetworkConn = resolveHasNetworkConnection(ws, sourceType);

      if (sourceType === 'FIRE_NETWORK') {
        if (toNullablePositiveNumber(ws.staticPressureBar) === null) {
          missingWaterFields.push('فشار استاتیک شبکه آب آتش‌نشانی (Bar)');
        }
        if (hasPumpFlag === true) {
          if (toNullablePositiveNumber(ws.pumpRatedFlowGpm) === null) {
            missingWaterFields.push('دبی نامی بوسترپمپ آتش‌نشانی (GPM)');
          }
          if (toNullablePositiveNumber(ws.pumpRatedPressureBar) === null) {
            missingWaterFields.push('فشار نامی پمپ آتش‌نشانی (Bar)');
          }
        }
      } else {
        if (toNullablePositiveNumber(ws.tankCapacityLiters) === null) {
          missingWaterFields.push('حجم مخزن آب اطفای حریق (لیتر)');
        }
        if (hasPumpFlag === true || (hasPumpFlag === null && !hasNetworkConn)) {
          if (toNullablePositiveNumber(ws.pumpRatedFlowGpm) === null) {
            missingWaterFields.push('دبی نامی بوسترپمپ آتش‌نشانی (GPM)');
          }
          if (toNullablePositiveNumber(ws.pumpRatedPressureBar) === null) {
            missingWaterFields.push('فشار نامی پمپ آتش‌نشانی (Bar)');
          }
        }
        if (hasNetworkConn && toNullablePositiveNumber(ws.staticPressureBar) === null) {
          missingWaterFields.push('فشار استاتیک شبکه آب متصل (Bar)');
        }
      }
    }
  }

  if (!floor) {
    missingRequiredFields.push('اطلاعات طبقه انتخاب‌شده');
  } else {
    if (!floor.floorLabel?.trim()) missingRequiredFields.push('نام/عنوان طبقه');
    if (!floor.lengthM || Number(floor.lengthM) <= 0) missingRequiredFields.push('طول طبقه (متر)');
    if (!floor.widthM || Number(floor.widthM) <= 0) missingRequiredFields.push('عرض طبقه (متر)');
    if (!floor.ceilingHeightM || Number(floor.ceilingHeightM) <= 0) missingRequiredFields.push('ارتفاع سقف طبقه (متر)');
    if (!floor.areaSqm || Number(floor.areaSqm) <= 0) missingRequiredFields.push('مساحت طبقه (مترمربع)');
  }

  return {
    isComplete: missingRequiredFields.length === 0,
    missingRequiredFields,
    missingWaterFields,
  };
}

/**
 * Classifies hazard group according to NFPA 13 Chapter 4 / 5 / 20 & material keywords
 */
export function determineHazardGroup(
  building: FireDesignBuilding,
  floor: FireDesignFloor
): { hazardGroup: HazardGroup; basisCitation: string } {
  if (building.riskLevelOverride && building.riskLevelOverride !== 'AUTO') {
    return {
      hazardGroup: building.riskLevelOverride,
      basisCitation: `انتخاب صریح مهندس طراح (${NFPA13_HAZARD_SPECS[building.riskLevelOverride].labelFa}) مطابق NFPA 13 (${building.nfpa13Edition})`,
    };
  }

  const text = `${building.storedMaterials} ${building.activityType} ${floor.notes || ''}`.toLowerCase();
  const hasHighPiledKeywords =
    /high[\s-]?pil|rack|قفسه|انبار\s*مرتفع|پلیمر|پلاستیک|پلی‌اتیلن|پلی‌پروپیلن|حلال\s*سنگین|نفتی|هیدروکربن/.test(
      text
    );
  const hasFlammableLiquidOrGas =
    building.hazardNature.includes('B') ||
    /بنزین|گازوئیل|نفت|الکل|حلال|تینر|مشتعل|پتروشیمی|لوله|راکتور|کمپرسور|هیدروکربن|گاز|lpg|lng|solvent|flammable/.test(
      text
    );

  if (building.occupancyType === 'WAREHOUSE' && (hasHighPiledKeywords || floor.ceilingHeightM >= 7.5)) {
    return {
      hazardGroup: 'SPECIAL_STORAGE',
      basisCitation: `NFPA 13 (${building.nfpa13Edition}) Ch. 20 / High-Piled Storage (ارتفاع سقف ${floor.ceilingHeightM}m یا کالای پلیمری/قفسه‌ای)`,
    };
  }

  if (building.occupancyType === 'INDUSTRIAL_PROCESS') {
    if (hasFlammableLiquidOrGas || building.hazardNature.includes('D')) {
      return {
        hazardGroup: 'EH2',
        basisCitation: `NFPA 13 (${building.nfpa13Edition}) Sec. 4.3.6 — واحد فرآیندی با سیالات قابل اشتعال/مواد پتروشیمی (Extra Hazard Group 2)`,
      };
    }
    return {
      hazardGroup: 'EH1',
      basisCitation: `NFPA 13 (${building.nfpa13Edition}) Sec. 4.3.5 — واحد صنعتی با بار حریق بالا (Extra Hazard Group 1)`,
    };
  }

  if (building.occupancyType === 'LABORATORY' || building.occupancyType === 'WORKSHOP' || building.occupancyType === 'WAREHOUSE') {
    return {
      hazardGroup: hasFlammableLiquidOrGas ? 'OH2' : 'OH1',
      basisCitation: `NFPA 13 (${building.nfpa13Edition}) Sec. 4.3.3/4.3.4 — کاربری آزمایشگاهی/کارگاهی/انبار عمومی`,
    };
  }

  if (building.occupancyType === 'KITCHEN_DINING' || building.occupancyType === 'PARKING') {
    return {
      hazardGroup: building.occupancyType === 'PARKING' ? 'OH1' : 'OH2',
      basisCitation: `NFPA 13 (${building.nfpa13Edition}) Sec. 4.3.3/4.3.4 — آشپزخانه صنعتی یا پارکینگ سرپوشیده`,
    };
  }

  if (
    building.occupancyType === 'CONTROL_ROOM' ||
    building.occupancyType === 'SERVER_ROOM' ||
    building.occupancyType === 'ELECTRICAL_SUBSTATION'
  ) {
    return {
      hazardGroup: 'OH1',
      basisCitation: `NFPA 13 (${building.nfpa13Edition}) Sec. 4.3.3 — اتاق کنترل/پست برق/سرور (همراه با الزام سیستم جایگزین گازی پاک/CO2)`,
    };
  }

  return {
    hazardGroup: 'LIGHT',
    basisCitation: `NFPA 13 (${building.nfpa13Edition}) Sec. 4.3.2 — کاربری اداری/ستادی کم‌خطر (Light Hazard)`,
  };
}

/**
 * Checks whether segment (x1,y1)->(x2,y2) intersects an obstacle bounding box.
 */
function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const minX = rx;
  const maxX = rx + rw;
  const minY = ry;
  const maxY = ry + rh;

  // Parametric Liang-Barsky clipping
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

function pointInsideRect(x: number, y: number, obs: FloorObstacle): boolean {
  return x >= obs.xM && x <= obs.xM + obs.widthM && y >= obs.yM && y <= obs.yM + obs.heightM;
}

function isLineBlocked(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: FloorObstacle[],
  mode: 'sprinkler' | 'travel'
): boolean {
  for (const obs of obstacles) {
    const blocks = mode === 'sprinkler' ? obs.blocksSprinkler : obs.blocksTravel;
    if (!blocks) continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, obs.xM, obs.yM, obs.widthM, obs.heightM)) {
      return true;
    }
  }
  return false;
}

/**
 * Generates NFPA 13 + NFPA 10 compatible candidate positions on the floor grid.
 */
export function generateSuggestedPlacement(
  building: FireDesignBuilding,
  floor: FireDesignFloor,
  hazardSpec: HazardTableSpec,
  needsSprinkler: boolean,
  extinguisherAllocations: {
    agent: AgentType;
    labelFa: string;
    rating: string;
    capacityFa: string;
    requiredCount: number;
    mountingLocationFa: string;
  }[],
  travelLimitM: number,
  kFactor: number,
  headTypeLabel: string
): PlacedSuppressionItem[] {
  const items: PlacedSuppressionItem[] = [];
  const L = Math.max(1, floor.lengthM);
  const W = Math.max(1, floor.widthM);
  const obstacles = floor.obstacles || [];

  // 1. Sprinkler Grid Placement respecting maxSpacingM & maxWallDistance (S/2)
  if (needsSprinkler) {
    const maxLinear = Math.min(hazardSpec.maxSpacingM, Math.sqrt(hazardSpec.maxAreaPerHeadSqm));
    const cols = Math.max(1, Math.ceil(L / maxLinear));
    const rows = Math.max(1, Math.ceil(W / maxLinear));
    const stepX = L / cols;
    const stepY = W / rows;
    const radius = Math.sqrt((stepX / 2) ** 2 + (stepY / 2) ** 2);

    let idx = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let xM = Number(((c + 0.5) * stepX).toFixed(2));
        let yM = Number(((r + 0.5) * stepY).toFixed(2));

        // Shift out of solid shafts/columns or blocking walls
        const insideSolid = obstacles.find((o) => pointInsideRect(xM, yM, o));
        if (insideSolid) {
          const shiftedX = insideSolid.xM + insideSolid.widthM + 0.6;
          xM = shiftedX <= L - 0.4 ? Number(shiftedX.toFixed(2)) : Number(Math.max(0.4, insideSolid.xM - 0.6).toFixed(2));
        }

        items.push({
          id: `sp-prop-${floor.id}-${idx}`,
          kind: 'SPRINKLER_PROPOSED',
          systemType: 'SPRINKLER_NFPA13',
          origin: 'PROPOSED',
          code: `SP-${floor.floorCode}-${String(idx).padStart(2, '0')}`,
          label: `اسپرینکلر پیشنهادی #${idx}`,
          xM,
          yM,
          coverageRadiusM: Number(radius.toFixed(2)),
          kFactor,
          sprinklerHeadType: headTypeLabel,
          mountingNote: `فاصله محوری ${stepX.toFixed(2)}×${stepY.toFixed(2)} متر (فاصله تا دیوار ≤ ${(maxLinear / 2).toFixed(2)}m)`,
        });
        idx++;
      }
    }

    // Ensure every enclosed/partitioned space has at least one sprinkler inside it (NFPA 13 compartment rule)
    for (const sp of floor.spaces || []) {
      if (!sp.sprinklerProtected && sp.hasCriticalElectronics) continue;
      const hasHeadInside = items.some(
        (it) =>
          it.kind === 'SPRINKLER_PROPOSED' &&
          it.xM >= sp.xM &&
          it.xM <= sp.xM + sp.widthM &&
          it.yM >= sp.yM &&
          it.yM <= sp.yM + sp.heightM
      );
      if (!hasHeadInside && sp.widthM >= 1 && sp.heightM >= 1) {
        const cx = Number(Math.min(L - 0.5, sp.xM + sp.widthM / 2).toFixed(2));
        const cy = Number(Math.min(W - 0.5, sp.yM + sp.heightM / 2).toFixed(2));
        const tooClose = items.some((it) => it.kind === 'SPRINKLER_PROPOSED' && Math.hypot(it.xM - cx, it.yM - cy) < 1.85);
        if (!tooClose) {
          items.push({
            id: `sp-prop-${floor.id}-${idx}`,
            kind: 'SPRINKLER_PROPOSED',
            systemType: 'SPRINKLER_NFPA13',
            origin: 'PROPOSED',
            code: `SP-${floor.floorCode}-${String(idx).padStart(2, '0')}`,
            label: `اسپرینکلر فضای ${sp.name}`,
            xM: cx,
            yM: cy,
            coverageRadiusM: Number(radius.toFixed(2)),
            kFactor,
            sprinklerHeadType: headTypeLabel,
            mountingNote: `پوشش مستقل فضای محصور «${sp.name}» مطابق NFPA 13`,
          });
          idx++;
        }
      }
    }

    // Add riser control valve near entrance (bottom-left perimeter)
    items.push({
      id: `val-prop-${floor.id}-1`,
      kind: 'RISER_VALVE',
      systemType: 'SPRINKLER_NFPA13',
      origin: 'PROPOSED',
      code: `RV-${floor.floorCode}-01`,
      label: 'رایزر و شیر کنترل زون (Alarm/Deluge Valve)',
      xM: Number(Math.min(1.5, L * 0.08).toFixed(2)),
      yM: Number(Math.min(1.5, W * 0.1).toFixed(2)),
      coverageRadiusM: 1.5,
      mountingNote: 'نزدیک ورودی اصلی طبقه با دسترسی اضطراری و فلو سوئیچ',
    });
  } else if (
    building.occupancyType === 'SERVER_ROOM' ||
    building.occupancyType === 'CONTROL_ROOM'
  ) {
    // Clean Agent Nozzle recommendation for server/control rooms
    const cols = Math.max(1, Math.ceil(L / 6.0));
    const rows = Math.max(1, Math.ceil(W / 6.0));
    let nIdx = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        items.push({
          id: `ca-prop-${floor.id}-${nIdx}`,
          kind: 'CLEAN_AGENT_NOZZLE',
          systemType: 'CLEAN_AGENT_NFPA2001',
          origin: 'PROPOSED',
          code: `FM-${floor.floorCode}-${String(nIdx).padStart(2, '0')}`,
          label: `نازل گاز پاک FM-200 / FK-5-1-12 #${nIdx}`,
          xM: Number((((c + 0.5) * L) / cols).toFixed(2)),
          yM: Number((((r + 0.5) * W) / rows).toFixed(2)),
          coverageRadiusM: 4.2,
          agentType: 'CLEAN_AGENT',
          mountingNote: 'سقفی / زیر سقف کاذب مطابق NFPA 2001 (حفاظت تجهیزات الکترونیکی بدون آب)',
        });
        nIdx++;
      }
    }
  }

  // 2. Portable Extinguisher Placement respecting partitioned spaces + perimeter/corridors
  let extIdx = 1;
  const totalExts = extinguisherAllocations.reduce((s, a) => s + a.requiredCount, 0);
  const perimeterSlots: { xM: number; yM: number; note: string; preferClean?: boolean }[] = [];

  for (const sp of floor.spaces || []) {
    const sx = Number(Math.min(L - 0.6, Math.max(0.6, sp.xM + 0.7)).toFixed(2));
    const sy = Number(Math.min(W - 0.6, Math.max(0.6, sp.yM + 0.7)).toFixed(2));
    if (!obstacles.some((o) => pointInsideRect(sx, sy, o))) {
      perimeterSlots.push({
        xM: sx,
        yM: sy,
        note: `ورودی زون «${sp.name}»`,
        preferClean: sp.hasCriticalElectronics,
      });
    }
  }

  if (totalExts > perimeterSlots.length) {
    const remainingNeeded = totalExts - perimeterSlots.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt((remainingNeeded * L) / Math.max(1, W))));
    const rows = Math.max(1, Math.ceil(remainingNeeded / cols));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (perimeterSlots.length >= totalExts) break;
        let xM =
          cols === 1
            ? Math.min(L - 0.6, 1.0)
            : Number((0.8 + (c * (L - 1.6)) / Math.max(1, cols - 1)).toFixed(2));
        let yM =
          rows === 1
            ? 0.7
            : Number((0.7 + (r * (W - 1.4)) / Math.max(1, rows - 1)).toFixed(2));
        const hitObs = obstacles.find((o) => pointInsideRect(xM, yM, o));
        if (hitObs) {
          xM = Number(Math.max(0.5, Math.min(L - 0.5, hitObs.xM + hitObs.widthM + 0.6)).toFixed(2));
        }
        perimeterSlots.push({
          xM,
          yM,
          note: r === 0 || r === rows - 1 ? 'روی دیوار/ستون مسیر خروج (ارتفاع دسته ۱.۱ متر)' : 'ستون میانی مسیر دسترسی ایمن',
        });
      }
    }
  }

  let slotCursor = 0;
  for (const alloc of extinguisherAllocations) {
    for (let i = 0; i < alloc.requiredCount; i++) {
      const slot = perimeterSlots[slotCursor % Math.max(1, perimeterSlots.length)] || {
        xM: 1.0,
        yM: 1.0,
        note: alloc.mountingLocationFa,
      };
      slotCursor++;

      items.push({
        id: `ext-prop-${floor.id}-${extIdx}`,
        kind: 'EXTINGUISHER_PROPOSED',
        systemType: 'EXTINGUISHER_NFPA10',
        origin: 'PROPOSED',
        code: `FE-${floor.floorCode}-${String(extIdx).padStart(2, '0')}`,
        label: `کپسول ${alloc.labelFa} (${alloc.capacityFa})`,
        xM: slot.xM,
        yM: slot.yM,
        coverageRadiusM: Number(Math.min(travelLimitM, 18).toFixed(1)),
        agentType: alloc.agent,
        rating: alloc.rating,
        capacityLabel: alloc.capacityFa,
        mountingNote: `${alloc.mountingLocationFa} — ${slot.note}`,
      });
      extIdx++;
    }
  }

  return items;
}

/**
 * Spatial 2D grid analysis to compute real coverage % and uncover blind spots for both sprinklers and extinguishers.
 */
export function analyzeSpatialCoverage(
  floor: FireDesignFloor,
  placedItems: PlacedSuppressionItem[],
  needsSprinkler: boolean,
  designSpacingXM: number,
  designSpacingYM: number,
  travelLimitM: number
): {
  sprinklerCoveragePercent: number;
  extinguisherCoveragePercent: number;
  maxObservedTravelM: number;
  uncoveredZones: UncoveredZone[];
} {
  const L = Math.max(1, floor.lengthM);
  const W = Math.max(1, floor.widthM);
  const obstacles = floor.obstacles || [];
  const stepM = Math.max(1.0, Math.sqrt((L * W) / 1400));

  const sprinklers = placedItems.filter(
    (p) => p.kind === 'SPRINKLER_PROPOSED' || p.kind === 'SPRINKLER_EXISTING'
  );
  const extinguishers = placedItems.filter(
    (p) => p.kind === 'EXTINGUISHER_PROPOSED' || p.kind === 'EXTINGUISHER_EXISTING'
  );

  let validCells = 0;
  let sprinklerCoveredCells = 0;
  let extCoveredCells = 0;
  let maxObservedTravelM = 0;

  const spUncoveredPoints: { x: number; y: number }[] = [];
  const extUncoveredPoints: { x: number; y: number }[] = [];

  const halfX = designSpacingXM / 2 + 0.35;
  const halfY = designSpacingYM / 2 + 0.35;

  for (let x = stepM / 2; x < L; x += stepM) {
    for (let y = stepM / 2; y < W; y += stepM) {
      // Skip cells inside solid columns or shafts
      const inSolid = obstacles.some(
        (o) => (o.type === 'SHAFT' || o.type === 'COLUMN') && pointInsideRect(x, y, o)
      );
      if (inSolid) continue;

      validCells++;

      // Sprinkler coverage check
      if (needsSprinkler) {
        let coveredBySp = false;
        for (const sp of sprinklers) {
          if (Math.abs(x - sp.xM) <= halfX && Math.abs(y - sp.yM) <= halfY) {
            if (!isLineBlocked(sp.xM, sp.yM, x, y, obstacles, 'sprinkler')) {
              coveredBySp = true;
              break;
            }
          }
        }
        if (coveredBySp) {
          sprinklerCoveredCells++;
        } else {
          spUncoveredPoints.push({ x, y });
        }
      }

      // Extinguisher travel-distance check (NFPA 10 actual travel path approximation)
      let minDist = Infinity;
      for (const ext of extinguishers) {
        const euclid = Math.hypot(x - ext.xM, y - ext.yM);
        const blocked = isLineBlocked(ext.xM, ext.yM, x, y, obstacles, 'travel');
        // Real travel path follows orthogonal aisles (~1.15x Euclidean, or blocked by partition -> excluded)
        if (!blocked) {
          const travelDist = euclid * 1.12;
          if (travelDist < minDist) minDist = travelDist;
        }
      }

      if (minDist < Infinity) {
        if (minDist > maxObservedTravelM) maxObservedTravelM = minDist;
      }

      if (minDist <= travelLimitM) {
        extCoveredCells++;
      } else {
        extUncoveredPoints.push({ x, y });
      }
    }
  }

  const sprinklerCoveragePercent = !needsSprinkler
    ? 100
    : validCells > 0
      ? Math.round((sprinklerCoveredCells / validCells) * 1000) / 10
      : 0;
  const extinguisherCoveragePercent =
    validCells > 0 ? Math.round((extCoveredCells / validCells) * 1000) / 10 : 0;

  // Cluster uncovered points into coarse quadrant zones so report & canvas stay readable
  const uncoveredZones: UncoveredZone[] = [];
  const clusterPoints = (
    pts: { x: number; y: number }[],
    system: 'SPRINKLER' | 'EXTINGUISHER',
    reasonFa: string
  ) => {
    if (pts.length === 0) return;
    const gridBucketSize = Math.max(4, Math.min(L, W) / 3);
    const buckets = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; count: number }>();

    for (const p of pts) {
      const bx = Math.floor(p.x / gridBucketSize);
      const by = Math.floor(p.y / gridBucketSize);
      const key = `${bx}-${by}`;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y, count: 1 });
      } else {
        existing.minX = Math.min(existing.minX, p.x);
        existing.maxX = Math.max(existing.maxX, p.x);
        existing.minY = Math.min(existing.minY, p.y);
        existing.maxY = Math.max(existing.maxY, p.y);
        existing.count++;
      }
    }

    let zIdx = 1;
    buckets.forEach((b) => {
      const wM = Math.max(stepM, Number((b.maxX - b.minX + stepM).toFixed(1)));
      const hM = Math.max(stepM, Number((b.maxY - b.minY + stepM).toFixed(1)));
      const areaSqm = Number((b.count * stepM * stepM).toFixed(1));
      if (areaSqm >= 2.0) {
        uncoveredZones.push({
          id: `blind-${system.toLowerCase()}-${zIdx++}`,
          system,
          xM: Number(Math.max(0, b.minX - stepM / 2).toFixed(1)),
          yM: Number(Math.max(0, b.minY - stepM / 2).toFixed(1)),
          widthM: Number(Math.min(L - Math.max(0, b.minX - stepM / 2), wM).toFixed(1)),
          heightM: Number(Math.min(W - Math.max(0, b.minY - stepM / 2), hM).toFixed(1)),
          areaSqm,
          reasonFa,
          severity: areaSqm > 12 ? 'HIGH' : 'MEDIUM',
        });
      }
    });
  };

  if (needsSprinkler) {
    clusterPoints(
      spUncoveredPoints,
      'SPRINKLER',
      'خارج از شعاع پوشش اسپرینکلر یا مسدود شده توسط دیوار/تیر/مانع سازه‌ای (NFPA 13)'
    );
  }
  clusterPoints(
    extUncoveredPoints,
    'EXTINGUISHER',
    `فاصله پیمایش واقعی بیش از سقف مجاز ${travelLimitM} متر یا مسدود شده توسط پارتیشن (NFPA 10)`
  );

  return {
    sprinklerCoveragePercent,
    extinguisherCoveragePercent,
    maxObservedTravelM: Number(maxObservedTravelM.toFixed(2)),
    uncoveredZones,
  };
}

/**
 * Detects Cold Soldering (over-density) conflicts where two sprinklers are closer than 1.8 m (6 ft) per NFPA 13.
 */
export function detectOverDensityConflicts(placedItems: PlacedSuppressionItem[]): {
  count: number;
  conflictingIds: string[];
  alerts: string[];
} {
  const sprinklers = placedItems.filter(
    (p) => p.kind === 'SPRINKLER_PROPOSED' || p.kind === 'SPRINKLER_EXISTING'
  );
  const conflictingIdSet = new Set<string>();
  const alerts: string[] = [];
  let count = 0;

  for (let i = 0; i < sprinklers.length; i++) {
    for (let j = i + 1; j < sprinklers.length; j++) {
      const a = sprinklers[i];
      const b = sprinklers[j];
      const dist = Math.hypot(a.xM - b.xM, a.yM - b.yM);
      if (dist < 1.8) {
        count++;
        conflictingIdSet.add(a.id);
        conflictingIdSet.add(b.id);
        alerts.push(
          `تداخل هم‌افزایی سرد (Cold Soldering): فاصله بین ${a.code} و ${b.code} برابر ${dist.toFixed(2)}m است (حداقل مجاز NFPA 13 برابر ۱.۸ متر بدون بافل).`
        );
      }
    }
  }

  return {
    count,
    conflictingIds: Array.from(conflictingIdSet),
    alerts,
  };
}

/**
 * Smart 4-Color Fire Protection Coverage Map Generator
 * - GREEN: Covered by ALL selected active systems + complete input + zero obstruction/over-density warnings
 * - RED: Blind spot / uncovered / blocked by obstacle / exceeded travel distance
 * - YELLOW: Engineering review needed (beam/false-ceiling obstruction or Cold Soldering < 1.8m)
 * - GRAY: Insufficient input data or solid shaft/column excluded from evaluation
 */
export function computeCoverageGrid(params: {
  building: FireDesignBuilding;
  floor: FireDesignFloor;
  calc: FloorCalculationResult;
  placedItems: PlacedSuppressionItem[];
  filters: {
    sprinkler: boolean;
    extinguisher: boolean;
    hydrant: boolean;
    alarm: boolean;
    cleanAgent: boolean;
  };
}): CoverageMapCell[] {
  const { building, floor, calc, placedItems, filters } = params;
  const L = Math.max(4, floor.lengthM || 0);
  const W = Math.max(4, floor.widthM || 0);
  const obstacles = floor.obstacles || [];

  const targetCells = 18;
  const cellSize = Math.max(1.2, Math.min(3.0, Math.max(L, W) / targetCells));
  const cols = Math.max(1, Math.ceil(L / cellSize));
  const rows = Math.max(1, Math.ceil(W / cellSize));
  const stepX = L / cols;
  const stepY = W / rows;

  const sprinklers = placedItems.filter((p) => p.kind === 'SPRINKLER_PROPOSED' || p.kind === 'SPRINKLER_EXISTING');
  const extinguishers = placedItems.filter((p) => p.kind === 'EXTINGUISHER_PROPOSED' || p.kind === 'EXTINGUISHER_EXISTING');
  const hydrants = placedItems.filter((p) => p.kind === 'HYDRANT_HOSE_PROPOSED' || p.kind === 'HYDRANT_HOSE_EXISTING' || p.kind === 'HOSE_BOX' || p.kind === 'FOAM_MONITOR_PROPOSED');
  const detectors = placedItems.filter((p) => p.kind === 'DETECTOR_SMOKE' || p.kind === 'DETECTOR_HEAT' || p.kind === 'DETECTOR_GAS');
  const cleanNozzles = placedItems.filter((p) => p.kind === 'CLEAN_AGENT_NOZZLE');

  const overDensity = detectOverDensityConflicts(placedItems);
  const overDensitySprinklers = sprinklers.filter((s) => overDensity.conflictingIds.includes(s.id));

  const hasCeilingObstruction =
    building.ceilingType === 'EXPOSED_BEAMS' ||
    building.ceilingType === 'SUSPENDED_CEILING' ||
    floor.beamDepthM > 0.1 ||
    floor.falseCeilingHeightM > 0.2;

  const halfX = Math.max(1.5, calc.sprinkler.designSpacingXM / 2 + 0.35);
  const halfY = Math.max(1.5, calc.sprinkler.designSpacingYM / 2 + 0.35);
  const travelLimitM = calc.detectedFireClasses.includes('K')
    ? 9.15
    : calc.detectedFireClasses.includes('B')
      ? calc.extinguisher.maxTravelDistanceClassBM
      : calc.extinguisher.maxTravelDistanceClassAM;

  const cells: CoverageMapCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xM = Number((c * stepX).toFixed(2));
      const yM = Number((r * stepY).toFixed(2));
      const cx = xM + stepX / 2;
      const cy = yM + stepY / 2;
      const reasonsFa: string[] = [];

      const inShaft = obstacles.some((o) => (o.type === 'SHAFT' || o.type === 'COLUMN') && pointInsideRect(cx, cy, o));
      if (inShaft || calc.calculationStatus === 'INCOMPLETE_DATA') {
        cells.push({
          xM,
          yM,
          widthM: Number(stepX.toFixed(2)),
          heightM: Number(stepY.toFixed(2)),
          status: 'GRAY',
          reasonsFa: [
            inShaft ? 'محدوده شفت یا ستون سازه‌ای (خارج از سطح پوشش)' : 'اطلاعات مهندسی طبقه/ساختمان ناقص است',
          ],
        });
        continue;
      }

      let nearestSp: number | null = null;
      let coveredSp = true;
      if (filters.sprinkler && calc.sprinkler.isRequiredOrRecommended) {
        coveredSp = false;
        for (const sp of sprinklers) {
          const d = Math.hypot(cx - sp.xM, cy - sp.yM);
          if (nearestSp === null || d < nearestSp) nearestSp = Number(d.toFixed(2));
          if (Math.abs(cx - sp.xM) <= halfX && Math.abs(cy - sp.yM) <= halfY && !isLineBlocked(sp.xM, sp.yM, cx, cy, obstacles, 'sprinkler')) {
            coveredSp = true;
          }
        }
        if (!coveredSp) reasonsFa.push('خارج از پوشش موثر اسپرینکلر یا مسدودشده با مانع (NFPA 13)');
      }

      let nearestExt: number | null = null;
      let coveredExt = true;
      if (filters.extinguisher) {
        let minDist = Infinity;
        for (const ext of extinguishers) {
          if (!isLineBlocked(ext.xM, ext.yM, cx, cy, obstacles, 'travel')) {
            const travel = Math.hypot(cx - ext.xM, cy - ext.yM) * 1.12;
            if (travel < minDist) minDist = travel;
          }
        }
        nearestExt = minDist < Infinity ? Number(minDist.toFixed(2)) : null;
        coveredExt = minDist <= travelLimitM;
        if (!coveredExt) reasonsFa.push(`فاصله پیمایش به خاموش‌کننده بیشتر از ${travelLimitM}m یا مسدود با پارتیشن (NFPA 10)`);
      }

      let nearestHyd: number | null = null;
      let coveredHyd = true;
      if (filters.hydrant && hydrants.length > 0) {
        let minH = Infinity;
        for (const hy of hydrants) {
          const d = Math.hypot(cx - hy.xM, cy - hy.yM) * 1.1;
          if (d <= hy.coverageRadiusM && !isLineBlocked(hy.xM, hy.yM, cx, cy, obstacles, 'travel')) {
            if (d < minH) minH = d;
          }
        }
        nearestHyd = minH < Infinity ? Number(minH.toFixed(2)) : null;
        coveredHyd = minH < Infinity;
        if (!coveredHyd) reasonsFa.push('خارج از شعاع شیلنگ/مانیتور هیدرانت (NFPA 14)');
      } else if (filters.hydrant && hydrants.length === 0) {
        coveredHyd = false;
        reasonsFa.push('فیلتر هیدرانت فعال است ولی هیچ جعبه/هیدرانت روی نقشه جانمایی نشده');
      }

      let nearestDet: number | null = null;
      let coveredDet = true;
      if (filters.alarm && detectors.length > 0) {
        let minD = Infinity;
        for (const dt of detectors) {
          const d = Math.hypot(cx - dt.xM, cy - dt.yM);
          if (d < minD) minD = d;
        }
        nearestDet = minD < Infinity ? Number(minD.toFixed(2)) : null;
        coveredDet = detectors.some((dt) => Math.hypot(cx - dt.xM, cy - dt.yM) <= dt.coverageRadiusM);
        if (!coveredDet) reasonsFa.push('خارج از شعاع پوشش دتکتور اعلام حریق (NFPA 72)');
      } else if (filters.alarm && detectors.length === 0) {
        coveredDet = false;
        reasonsFa.push('فیلتر اعلام حریق فعال است ولی دتکتور روی نقشه ثبت نشده');
      }

      let coveredClean = true;
      if (filters.cleanAgent) {
        if (cleanNozzles.length === 0) {
          coveredClean = false;
          reasonsFa.push('نازل گاز پاک/فوم در این محدوده جانمایی نشده است');
        } else {
          coveredClean = cleanNozzles.some((n) => Math.hypot(cx - n.xM, cy - n.yM) <= n.coverageRadiusM);
          if (!coveredClean) reasonsFa.push('خارج از شعاع پوشش نازل سیستم گازی');
        }
      }

      const isAnyRed = !coveredSp || !coveredExt || !coveredHyd || !coveredDet || !coveredClean;
      const nearOverDensity =
        filters.sprinkler && overDensitySprinklers.some((s) => Math.hypot(cx - s.xM, cy - s.yM) <= 2.0);
      const needsReview = nearOverDensity || (filters.sprinkler && hasCeilingObstruction);

      let status: CoverageCellStatus = 'GREEN';
      if (isAnyRed) {
        status = 'RED';
      } else if (needsReview) {
        status = 'YELLOW';
        if (nearOverDensity) reasonsFa.push('هشدار تراکم بیش‌ازحد / Cold Soldering (< 1.8m)');
        if (hasCeilingObstruction) reasonsFa.push('نیازمند بررسی سایه‌تیر یا فضای بالای سقف کاذب (NFPA 13)');
      } else {
        reasonsFa.push('پوشش کامل و منطبق با کلیه سیستم‌های انتخاب‌شده');
      }

      cells.push({
        xM,
        yM,
        widthM: Number(stepX.toFixed(2)),
        heightM: Number(stepY.toFixed(2)),
        status,
        reasonsFa,
        nearestSprinklerM: nearestSp,
        nearestExtinguisherM: nearestExt,
        nearestHydrantM: nearestHyd,
        nearestDetectorM: nearestDet,
      });
    }
  }

  return cells;
}

/**
 * Classifies existing fire_equipment items into Agent/Category buckets for deficit & compatibility check.
 */
function classifyExistingExtinguisherAgent(rawType = ''): AgentType {
  const t = rawType.toLowerCase();
  if (/co2|کربن|دی.?اکسید/.test(t)) return 'CO2';
  if (/فوم|foam|afff/.test(t)) return 'FOAM_AFFF';
  if (/آب|water/.test(t)) return 'WATER';
  if (/پاک|fm|clean|halotron|گازی/.test(t)) return 'CLEAN_AGENT';
  if (/کلاس\s*k|چربی|wet/.test(t)) return 'WET_CHEMICAL';
  if (/کلاس\s*d|فلز/.test(t)) return 'CLASS_D_POWDER';
  return 'ABC_DRY_POWDER';
}

/**
 * Master NFPA 13 + NFPA 10 Floor Engineering Calculation Entry Point
 */
export function runNfpaFloorCalculation(params: {
  building: FireDesignBuilding;
  floor: FireDesignFloor;
  sprinklerConfig?: SprinklerConfigInput;
  extinguisherConfig?: ExtinguisherConfigInput;
  placedItems?: PlacedSuppressionItem[];
  existingEquipment?: ExistingEquipmentSummaryItem[];
}): FloorCalculationResult {
  const { building, floor } = params;
  const sprinklerConfig = params.sprinklerConfig || {};
  const extinguisherConfig = params.extinguisherConfig || {};
  const existingEquipment = params.existingEquipment || [];

  const nfpa13Edition: Nfpa13Edition = building.nfpa13Edition || '2022';
  const nfpa10Edition: Nfpa10Edition = building.nfpa10Edition || '2022';
  const n13Ref = getNfpa13TableCitation(nfpa13Edition);
  const n10Ref = getNfpa10TableCitation(nfpa10Edition);

  const validation = validateInputsForCalculation(building, floor);

  const { hazardGroup, basisCitation } = determineHazardGroup(building, floor);
  const hazardSpec = NFPA13_HAZARD_SPECS[hazardGroup];

  // Collect all fire classes across building & floor spaces
  const classSet = new Set<FireClass>(building.hazardNature || []);
  for (const sp of floor.spaces || []) {
    for (const fc of sp.hazardClasses || []) classSet.add(fc);
  }
  if (building.occupancyType === 'KITCHEN_DINING') classSet.add('K');
  if (
    building.occupancyType === 'CONTROL_ROOM' ||
    building.occupancyType === 'SERVER_ROOM' ||
    building.occupancyType === 'ELECTRICAL_SUBSTATION'
  ) {
    classSet.add('C');
  }
  if (classSet.size === 0) classSet.add('A');
  const detectedFireClasses = Array.from(classSet);

  // If mandatory architectural/hazard inputs are incomplete, refuse definitive results!
  if (!validation.isComplete) {
    return {
      calculationStatus: 'INCOMPLETE_DATA',
      missingRequiredFields: validation.missingRequiredFields,
      warnings: [
        `محاسبه قطعی به دلیل تکمیل نبودن ${validation.missingRequiredFields.length} فیلد الزامی متوقف شد.`,
      ],
      nfpa13Edition,
      nfpa10Edition,
      hazardGroup,
      hazardGroupLabelFa: hazardSpec.labelFa,
      hazardBasisCitation: basisCitation,
      detectedFireClasses,
      sprinkler: {
        isRequiredOrRecommended: false,
        recommendedHeadType: 'PENDENT',
        recommendedHeadLabelFa: 'در انتظار تکمیل داده‌ها',
        kFactor: hazardSpec.recommendedKFactor,
        tempRatingC: 68,
        maxCoveragePerHeadSqm: hazardSpec.maxAreaPerHeadSqm,
        maxSpacingM: hazardSpec.maxSpacingM,
        minSpacingM: hazardSpec.minSpacingM,
        maxWallDistanceM: Number((hazardSpec.maxSpacingM / 2).toFixed(2)),
        designSpacingXM: 0,
        designSpacingYM: 0,
        calculatedHeadCount: 0,
        placedSprinklerCount: 0,
        coveragePercent: 0,
        obstructionAlerts: [],
        hydraulics: {
          applicable: false,
          standardRef: n13Ref.hydraulicRef,
          designDensityGpmSqft: 0,
          designDensityMmMin: 0,
          remoteAreaSqft: 0,
          remoteAreaSqm: 0,
          kFactor: hazardSpec.recommendedKFactor,
          flowPerHeadGpm: 0,
          flowPerHeadLpm: 0,
          operatingPressurePsi: 0,
          operatingPressureBar: 0,
          sprinklerDemandGpm: 0,
          sprinklerDemandLpm: 0,
          hoseStreamAllowanceGpm: 0,
          hoseStreamAllowanceLpm: 0,
          totalWaterDemandGpm: 0,
          totalWaterDemandLpm: 0,
          supplyDurationMin: 0,
          requiredTankVolumeLiters: 0,
          frictionLossBar: 0,
          elevationLossBar: 0,
          totalRequiredPressureBar: 0,
          cFactorUsed: 120,
          riserDiameterMm: 100,
          waterSupplyStatus: 'NEEDS_WATER_DATA',
          missingWaterFields: validation.missingWaterFields,
          tankCheckDetailFa: 'در انتظار تکمیل اطلاعات پایه ساختمان و طبقه',
          pumpCheckDetailFa: 'در انتظار تکمیل اطلاعات پایه ساختمان و طبقه',
        },
      },
      extinguisher: {
        maxTravelDistanceClassAM: 22.9,
        maxTravelDistanceClassBM: 15.25,
        maxAreaPerUnitClassASqm: 278.7,
        recommendedPrimaryAgent: 'ABC_DRY_POWDER',
        requiredTotalCount: 0,
        placedExtinguisherCount: 0,
        coveragePercent: 0,
        maxObservedTravelM: 0,
        compatibilityMatrix: [],
        allocationByAgent: [],
      },
      uncoveredZones: [],
      comparisonRows: [],
      complianceChecks: [
        {
          id: 'chk-data-complete',
          standard: 'NFPA 13',
          edition: nfpa13Edition,
          clause: 'اطلاعات ورودی',
          titleFa: 'کفایت داده‌های مهندسی ساختمان و طبقه',
          status: 'INCOMPLETE',
          detailFa: `فیلدهای ناقص: ${validation.missingRequiredFields.join('، ')}`,
        },
      ],
      suggestedItems: [],
      engineeringDisclaimerFa: ENGINEERING_DISCLAIMER_FA,
    };
  }

  // =========================================================================
  // STAGE 3: NFPA 13 SPRINKLER & HYDRAULIC CALCULATIONS
  // =========================================================================
  const isWaterUnsuitableRoom =
    building.occupancyType === 'SERVER_ROOM' ||
    building.occupancyType === 'ELECTRICAL_SUBSTATION' ||
    (building.occupancyType === 'CONTROL_ROOM' && !detectedFireClasses.includes('A'));

  const hasClassDMetal = detectedFireClasses.includes('D');
  const needsSprinkler = !hasClassDMetal && !isWaterUnsuitableRoom;

  let suppressionAlternativeNoteFa: string | undefined;
  if (hasClassDMetal) {
    suppressionAlternativeNoteFa =
      'هشدار بحرانی NFPA 13/484: وجود فلزات قابل اشتعال (کلاس D) استفاده از سیستم اسپرینکلر آبی را در این بخش ممنوع/خطرناک می‌سازد (خطر واکنش انفجاری هیدروژن). سیستم پودری خشک کلاس D یا عامل تخصصی الزامی است.';
  } else if (isWaterUnsuitableRoom) {
    suppressionAlternativeNoteFa =
      'توصیه مهندسی NFPA 13 / NFPA 2001 / NFPA 75: در اتاق سرور، پست برق و کنترل‌روم‌های حساس، به جای اسپرینکلر آب‌پاش تر، سیستم اطفای گازی پاک (FM-200 / FK-5-1-12) یا سیستم Pre-Action دو مرحله‌ای پیش‌بینی شود.';
  }

  // Determine sprinkler head type
  let recommendedHeadType = sprinklerConfig.headType || 'PENDENT';
  let recommendedHeadLabelFa = 'اسپرینکلر پایین‌زن استاندارد (Standard Pendent)';
  let tempRatingC = sprinklerConfig.tempRatingC || 68; // 155°F Red bulb default

  if (!sprinklerConfig.headType) {
    if (hazardGroup === 'SPECIAL_STORAGE') {
      recommendedHeadType = 'ESFR';
      recommendedHeadLabelFa = 'اسپرینکلر واکنش سریع سرکوب‌گر (ESFR / CMSA) ویژه انبارش مرتفع';
    } else if (building.ceilingType === 'SUSPENDED_CEILING' || floor.falseCeilingHeightM > 0.2) {
      recommendedHeadType = 'CONCEALED';
      recommendedHeadLabelFa = 'اسپرینکلر توکار/سقف کاذب (Concealed / Recessed Pendent) + پوشش فضای بالای سقف کاذب';
    } else if (
      building.occupancyType === 'INDUSTRIAL_PROCESS' ||
      building.ceilingType === 'OPEN_TRUSS' ||
      building.ceilingType === 'EXPOSED_BEAMS'
    ) {
      recommendedHeadType = 'UPRIGHT';
      recommendedHeadLabelFa = 'اسپرینکلر بالازن صنعتی (Standard/Quick Upright)';
    } else if (building.occupancyType === 'ADMINISTRATIVE') {
      recommendedHeadType = 'PENDENT';
      recommendedHeadLabelFa = 'اسپرینکلر پایین‌زن واکنش سریع (Quick Response Pendent)';
    }
  }

  if (building.occupancyType === 'KITCHEN_DINING' || building.occupancyType === 'INDUSTRIAL_PROCESS') {
    tempRatingC = sprinklerConfig.tempRatingC || 93; // 200°F Green bulb for elevated ambient/process heat
  }

  const kFactor = sprinklerConfig.kFactor || hazardSpec.recommendedKFactor;
  const maxLinearSpacing = Math.min(hazardSpec.maxSpacingM, Math.sqrt(hazardSpec.maxAreaPerHeadSqm));
  const cols = Math.max(1, Math.ceil(floor.lengthM / maxLinearSpacing));
  const rows = Math.max(1, Math.ceil(floor.widthM / maxLinearSpacing));
  const designSpacingXM = Number((floor.lengthM / cols).toFixed(2));
  const designSpacingYM = Number((floor.widthM / rows).toFixed(2));
  const calculatedHeadCount = needsSprinkler ? cols * rows : 0;

  // Obstruction & Ceiling Analysis
  const obstructionAlerts: string[] = [];
  if (building.ceilingType === 'EXPOSED_BEAMS' || floor.beamDepthM > 0.1) {
    const beamDepthCm = Math.round((floor.beamDepthM || 0.35) * 100);
    obstructionAlerts.push(
      `سقف دارای تیرآهن/تیرچه به عمق ${beamDepthCm} سانتی‌متر است: رعایت قانون ۳ برابر فاصله (${n13Ref.obstructionRef}) برای جلوگیری از سایه‌اندازی پاشش اسپرینکلر الزامی است.`
    );
  }
  if (building.ceilingType === 'SUSPENDED_CEILING' || floor.falseCeilingHeightM > 0.2) {
    obstructionAlerts.push(
      `فضای بالای سقف کاذب (ارتفاع ${floor.falseCeilingHeightM.toFixed(2)} متر): طبق NFPA 13 بند 9.2.1 در صورت وجود مصالح قابل اشتعال یا داکت‌های کابل غیرمجاز، نصب اسپرینکلر بالازن در فضای پنهان سقف کاذب نیز الزامی می‌شود.`
    );
  }
  if (floor.ceilingHeightM > 9.1) {
    obstructionAlerts.push(
      `ارتفاع سقف (${floor.ceilingHeightM} متر) بیش از ۹.۱ متر است: تاخیر حرارتی عملگر تشدید می‌شود؛ استفاده از ضریب K≥${Math.max(8.0, kFactor)} و کاهش فاصله جانمایی یا طراحی ویژه الزامی است.`
    );
  }
  if ((floor.obstacles || []).some((o) => o.blocksSprinkler)) {
    obstructionAlerts.push(
      'موانع داخلی و دیوارهای جداکننده روی پلان ثبت شده‌اند؛ پاشش اسپرینکلرها نباید با دیوار یا پارتیشن هم‌تراز قطع شود و هر زون محصور باید اسپرینکلر مستقل داشته باشد.'
    );
  }

  // Hydraulic Calculations (Hazen-Williams)
  const designDensityGpmSqft = sprinklerConfig.designDensityOverride || hazardSpec.designDensityGpmSqft;
  const designDensityMmMin = Number((designDensityGpmSqft * 40.7458).toFixed(2));
  const remoteAreaSqft = sprinklerConfig.remoteAreaSqftOverride || hazardSpec.remoteAreaSqft;
  const remoteAreaSqm = Number((remoteAreaSqft * 0.092903).toFixed(1));

  const areaPerHeadSqft = Math.min(
    hazardSpec.maxAreaPerHeadSqft,
    Math.max(64, (designSpacingXM * designSpacingYM) / 0.092903)
  );
  const flowPerHeadGpm = Number((designDensityGpmSqft * areaPerHeadSqft).toFixed(2));
  const flowPerHeadLpm = Number((flowPerHeadGpm * 3.78541).toFixed(1));
  // Minimum 7 psi (0.48 bar) per NFPA 13 Sec. 28.2.4.11
  const operatingPressurePsi = Number(Math.max(7, (flowPerHeadGpm / kFactor) ** 2).toFixed(2));
  const operatingPressureBar = Number((operatingPressurePsi / 14.5038).toFixed(2));

  // Hydraulic Demand with 15% preliminary grid imbalance factor
  const effectiveRemoteAreaSqft = Math.min(remoteAreaSqft, Math.max(areaPerHeadSqft, floor.areaSqm / 0.092903));
  const sprinklerDemandGpm = needsSprinkler
    ? Number((designDensityGpmSqft * effectiveRemoteAreaSqft * 1.15).toFixed(1))
    : 0;
  const sprinklerDemandLpm = Number((sprinklerDemandGpm * 3.78541).toFixed(0));

  const ws = building.waterSupply || {};
  const hoseStreamAllowanceGpm =
    ws.hoseStreamAllowanceGpm && ws.hoseStreamAllowanceGpm > 0
      ? Number(ws.hoseStreamAllowanceGpm)
      : hazardSpec.hoseStreamGpm;
  const hoseStreamAllowanceLpm = Number((hoseStreamAllowanceGpm * 3.78541).toFixed(0));

  const totalWaterDemandGpm = Number((sprinklerDemandGpm + hoseStreamAllowanceGpm).toFixed(1));
  const totalWaterDemandLpm = Number((totalWaterDemandGpm * 3.78541).toFixed(0));
  const supplyDurationMin =
    ws.supplyDurationMin && ws.supplyDurationMin > 0
      ? Number(ws.supplyDurationMin)
      : hazardSpec.durationMin;
  const requiredTankVolumeLiters = Math.round(totalWaterDemandLpm * supplyDurationMin);

  // Hazen-Williams Pipe Friction Loss: p = 4.52 * Q^1.85 / (C^1.85 * d^4.87) [psi/ft]
  const pipeMat = ws.pipeMaterial || 'BLACK_STEEL_WET';
  const cFactorUsed = ws.cFactor && ws.cFactor > 0 ? Number(ws.cFactor) : PIPE_C_FACTORS[pipeMat] || 120;
  const riserDiameterMm = ws.riserDiameterMm && ws.riserDiameterMm > 0 ? Number(ws.riserDiameterMm) : 100;
  const diameterInch = riserDiameterMm / 25.4;

  const equivalentLengthM =
    floor.lengthM + floor.widthM + Math.max(0, floor.floorOrder) * floor.ceilingHeightM + 25; // 25m fitting equivalent
  const equivalentLengthFt = equivalentLengthM * 3.28084;

  const qForFriction = Math.max(10, sprinklerDemandGpm);
  const psiPerFt =
    (4.52 * Math.pow(qForFriction, 1.85)) /
    (Math.pow(cFactorUsed, 1.85) * Math.pow(diameterInch, 4.87));
  const frictionLossPsi = psiPerFt * equivalentLengthFt;
  const frictionLossBar = Number((frictionLossPsi / 14.5038).toFixed(2));

  const elevationHeightM = Math.max(0, floor.floorOrder * floor.ceilingHeightM) + floor.ceilingHeightM;
  const elevationLossBar = Number((elevationHeightM * 0.0981).toFixed(2));
  const valveAndFittingLossBar = needsSprinkler ? 0.35 : 0;

  const totalRequiredPressureBar = needsSprinkler
    ? Number((operatingPressureBar + frictionLossBar + elevationLossBar + valveAndFittingLossBar).toFixed(2))
    : 0;

  // Water Source, Tank & Pump Adequacy Evaluation (source-aware, strict gate)
  const sourceTypeUsed = resolveWaterSourceType(building, 'STORAGE_TANK');
  const hasPumpFlag = resolveHasFirePump(ws);
  const hasNetworkConn = resolveHasNetworkConnection(ws, sourceTypeUsed);
  const isLegacyUnavailable = ws.isAvailable === false && !building.waterSourceType && !ws.sourceType;

  const staticBar = toNullablePositiveNumber(ws.staticPressureBar);
  const residualBar = toNullablePositiveNumber(ws.residualPressureBar);
  const effectiveNetworkBar =
    residualBar !== null
      ? residualBar
      : staticBar !== null
        ? Number((staticBar * 0.85).toFixed(2))
        : null;

  let waterSupplyStatus: HydraulicCalculationResult['waterSupplyStatus'] = 'NEEDS_WATER_DATA';
  let tankCheckDetailFa = '';
  let pumpCheckDetailFa = '';

  if (isLegacyUnavailable) {
    waterSupplyStatus = 'INADEQUATE';
    tankCheckDetailFa = 'کاربر اعلام کرده مخزن/منبع آب اطفا در این ساختمان وجود ندارد؛ احداث یا اتصال به رینگ آتش‌نشانی الزامی است.';
    pumpCheckDetailFa = 'بوسترپمپ آتش‌نشانی موجود نیست؛ تامین فشار/دبی مورد نیاز ممکن نیست.';
  } else if (validation.missingWaterFields.length > 0) {
    waterSupplyStatus = 'NEEDS_WATER_DATA';
    if (sourceTypeUsed === 'FIRE_NETWORK') {
      tankCheckDetailFa = `منبع آب: شبکه آب آتش‌نشانی (بدون مخزن ذخیره اختصاصی) — داده‌های ناقص: ${validation.missingWaterFields.join('، ')}. دبی طراحی مورد نیاز: ${totalWaterDemandGpm} GPM به مدت ${supplyDurationMin} دقیقه.`;
      pumpCheckDetailFa =
        hasPumpFlag === false
          ? `ارزیابی مستقیم فشار شبکه ممکن نیست. فشار کل مورد نیاز رایزر: ${totalRequiredPressureBar} Bar.`
          : `امکان ارزیابی قطعی بوسترپمپ/شبکه وجود ندارد. نقطه کار مورد نیاز: دبی ${totalWaterDemandGpm} GPM در فشار ${totalRequiredPressureBar} Bar.`;
    } else {
      tankCheckDetailFa = `امکان تایید نهایی حجم مخزن وجود ندارد (داده‌های ناقص: ${validation.missingWaterFields.join('، ')}). نیاز محاسبه‌شده: ${requiredTankVolumeLiters.toLocaleString()} لیتر.`;
      pumpCheckDetailFa = `امکان ارزیابی قطعی بوسترپمپ وجود ندارد. نقطه کار مورد نیاز: دبی ${totalWaterDemandGpm} GPM در فشار ${totalRequiredPressureBar} Bar.`;
    }
  } else if (sourceTypeUsed === 'FIRE_NETWORK') {
    const residualNote =
      residualBar !== null
        ? `فشار باقیمانده شبکه: ${residualBar} Bar`
        : `فشار موثر برآوردی (۸۵٪ استاتیک): ${effectiveNetworkBar} Bar — انجام تست دبی/فشار باقیمانده توصیه می‌شود`;

    tankCheckDetailFa = `منبع تأمین: شبکه آب آتش‌نشانی (بدون مخزن اختصاصی) | دبی هم‌زمان مورد نیاز: ${totalWaterDemandGpm} GPM (شامل ${hoseStreamAllowanceGpm} GPM هوز) به مدت ${supplyDurationMin} دقیقه | فشار استاتیک ${staticBar} Bar (${residualNote}).`;

    if (hasPumpFlag === true) {
      const pumpFlow = toNullablePositiveNumber(ws.pumpRatedFlowGpm) ?? 0;
      const pumpPress = toNullablePositiveNumber(ws.pumpRatedPressureBar) ?? 0;
      const combinedBar = Number(((effectiveNetworkBar ?? 0) + pumpPress).toFixed(2));
      const flowOk = pumpFlow >= totalWaterDemandGpm;
      const pressOk = combinedBar >= totalRequiredPressureBar;
      waterSupplyStatus = flowOk && pressOk ? 'ADEQUATE' : 'INADEQUATE';

      pumpCheckDetailFa =
        flowOk && pressOk
          ? `تایید کفایت شبکه + بوسترپمپ: دبی پمپ ${pumpFlow} GPM ≥ ${totalWaterDemandGpm} GPM و فشار قابل تأمین ${combinedBar} Bar ≥ نیاز ${totalRequiredPressureBar} Bar.`
          : `نامناسب بودن مشخصات شبکه/پمپ: ${!flowOk ? `کسری دبی (${pumpFlow} < ${totalWaterDemandGpm} GPM)` : ''} ${!pressOk ? `کسری فشار (${combinedBar} < ${totalRequiredPressureBar} Bar)` : ''}`.trim();
    } else {
      const availBar = effectiveNetworkBar ?? 0;
      const pressOk = availBar >= totalRequiredPressureBar;
      waterSupplyStatus = pressOk ? 'ADEQUATE' : 'INADEQUATE';
      pumpCheckDetailFa = pressOk
        ? `تایید کفایت شبکه بدون پمپ: فشار موثر شبکه (${availBar} Bar) پاسخگوی فشار کل مورد نیاز (${totalRequiredPressureBar} Bar) در دبی ${totalWaterDemandGpm} GPM است.`
        : `کسری فشار شبکه بدون پمپ: فشار موثر شبکه (${availBar} Bar) < فشار مورد نیاز (${totalRequiredPressureBar} Bar)؛ نصب بوسترپمپ آتش‌نشانی (NFPA 20) الزامی است.`;
    }
  } else {
    const tankCap = toNullablePositiveNumber(ws.tankCapacityLiters) ?? 0;
    const tankOk = tankCap >= requiredTankVolumeLiters;
    const netNote =
      hasNetworkConn && staticBar !== null
        ? ` | اتصال پشتیبان شبکه با فشار استاتیک ${staticBar} Bar${residualBar !== null ? ` / باقیمانده ${residualBar} Bar` : ''}`
        : '';

    tankCheckDetailFa = tankOk
      ? `تایید کفایت حجم مخزن: موجود ${tankCap.toLocaleString()} لیتر ≥ مورد نیاز ${requiredTankVolumeLiters.toLocaleString()} لیتر (${supplyDurationMin} دقیقه با احتساب ${hoseStreamAllowanceGpm} GPM هوز)${netNote}.`
      : `کسری حجم مخزن: موجود ${tankCap.toLocaleString()} لیتر < مورد نیاز ${requiredTankVolumeLiters.toLocaleString()} لیتر (کسری ${(requiredTankVolumeLiters - tankCap).toLocaleString()} لیتر، مدت ${supplyDurationMin} دقیقه)${netNote}.`;

    if (hasPumpFlag === true || (hasPumpFlag === null && !hasNetworkConn)) {
      const pumpFlow = toNullablePositiveNumber(ws.pumpRatedFlowGpm) ?? 0;
      const pumpPress = toNullablePositiveNumber(ws.pumpRatedPressureBar) ?? 0;
      const flowOk = pumpFlow >= totalWaterDemandGpm;
      const pressOk = pumpPress >= totalRequiredPressureBar;
      waterSupplyStatus = tankOk && flowOk && pressOk ? 'ADEQUATE' : 'INADEQUATE';

      pumpCheckDetailFa =
        flowOk && pressOk
          ? `تایید کفایت پمپ: پمپ (${pumpFlow} GPM @ ${pumpPress} Bar) پاسخگوی نیاز (${totalWaterDemandGpm} GPM @ ${totalRequiredPressureBar} Bar) است.`
          : `نامناسب بودن مشخصات پمپ: ${!flowOk ? `کسری دبی (${pumpFlow} < ${totalWaterDemandGpm} GPM)` : ''} ${!pressOk ? `کسری هد/فشار (${pumpPress} < ${totalRequiredPressureBar} Bar)` : ''}`.trim();
    } else if (hasNetworkConn && effectiveNetworkBar !== null) {
      const pressOk = effectiveNetworkBar >= totalRequiredPressureBar;
      waterSupplyStatus = tankOk && pressOk ? 'ADEQUATE' : 'INADEQUATE';
      pumpCheckDetailFa = pressOk
        ? `بدون بوسترپمپ؛ فشار موثر شبکه متصل (${effectiveNetworkBar} Bar) ≥ فشار مورد نیاز (${totalRequiredPressureBar} Bar).`
        : `بدون بوسترپمپ؛ فشار شبکه متصل (${effectiveNetworkBar} Bar) < نیاز (${totalRequiredPressureBar} Bar) و نصب پمپ آتش‌نشانی (NFPA 20) ضروری است.`;
    } else {
      waterSupplyStatus = 'INADEQUATE';
      pumpCheckDetailFa =
        'پمپ آتش‌نشانی در این ساختمان موجود نیست؛ مخزن ذخیره بدون بوسترپمپ (NFPA 20) قادر به تأمین فشار و دبی سیستم اطفا نمی‌باشد.';
    }
  }

  const hydraulics: HydraulicCalculationResult = {
    applicable: needsSprinkler,
    standardRef: `${n13Ref.densityRef} | ${n13Ref.hydraulicRef}`,
    designDensityGpmSqft,
    designDensityMmMin,
    remoteAreaSqft: Math.round(effectiveRemoteAreaSqft),
    remoteAreaSqm: Number((effectiveRemoteAreaSqft * 0.092903).toFixed(1)),
    kFactor,
    flowPerHeadGpm,
    flowPerHeadLpm,
    operatingPressurePsi,
    operatingPressureBar,
    sprinklerDemandGpm,
    sprinklerDemandLpm,
    hoseStreamAllowanceGpm,
    hoseStreamAllowanceLpm,
    totalWaterDemandGpm,
    totalWaterDemandLpm,
    supplyDurationMin,
    requiredTankVolumeLiters,
    frictionLossBar,
    elevationLossBar,
    totalRequiredPressureBar,
    cFactorUsed,
    riserDiameterMm,
    sourceTypeUsed,
    waterSupplyStatus,
    missingWaterFields: validation.missingWaterFields,
    tankCheckDetailFa,
    pumpCheckDetailFa,
  };

  // =========================================================================
  // STAGE 4: NFPA 10 PORTABLE EXTINGUISHER SIZING & COMPATIBILITY
  // =========================================================================
  const maxTravelDistanceClassAM = 22.9; // 75 ft (NFPA 10 Table 6.2.1.1)
  const maxTravelDistanceClassBM =
    hazardGroup === 'LIGHT' ? 9.15 : 15.25; // 30 ft for 10-B or 50 ft for 20-B/40-B/80-B (Table 6.3.1.1)

  const maxAreaPerUnitClassASqm =
    hazardGroup === 'LIGHT'
      ? 278.7 // 3000 ft2 per A (max 11,250 ft2 = 1045 m2)
      : hazardGroup === 'OH1' || hazardGroup === 'OH2'
        ? 139.4 // 1500 ft2 per A
        : 92.9; // 1000 ft2 per A

  const sensitiveElectronics =
    building.occupancyType === 'SERVER_ROOM' ||
    building.occupancyType === 'CONTROL_ROOM' ||
    building.occupancyType === 'ELECTRICAL_SUBSTATION' ||
    (floor.spaces || []).some((s) => s.hasCriticalElectronics);

  const compatibilityMatrix: AgentCompatibilityDecision[] = [];

  if (detectedFireClasses.includes('A')) {
    compatibilityMatrix.push({
      fireClass: 'A',
      zoneName: 'مواد جامد قابل اشتعال (چوب، کاغذ، بسته‌بندی، پلاستیک)',
      recommendedAgent: sensitiveElectronics ? 'CLEAN_AGENT' : 'ABC_DRY_POWDER',
      recommendedLabelFa: sensitiveElectronics
        ? AGENT_LABELS_FA.CLEAN_AGENT
        : AGENT_LABELS_FA.ABC_DRY_POWDER,
      recommendedCapacityFa: extinguisherConfig.preferHigherCapacity ? '۱۲ کیلوگرم / ۹ لیتری' : '۶ کیلوگرم',
      recommendedRating: hazardGroup === 'LIGHT' ? '2-A:10-B:C' : '4-A:40-B:C',
      forbiddenAgents: [
        {
          agent: 'CO2',
          labelFa: AGENT_LABELS_FA.CO2,
          reasonFa: 'CO2 فاقد رتبه‌بندی کلاس A بوده و در آتش‌سوزی مواد جامد عمقی امکان بازگشت شعله دارد.',
        },
      ],
      notesFa: sensitiveElectronics
        ? 'به دلیل وجود تجهیزات الکترونیکی حساس، پودر خشک ABC آسیب ثانویه ایجاد می‌کند؛ گاز پاک ارجح است.'
        : 'کپسول پودر ABC ۶ کیلویی با رتبه حداقل 3-A/4-A یا آب تحت فشار (در نبود برق) مجاز است.',
    });
  }

  if (detectedFireClasses.includes('B')) {
    const useFoam =
      building.occupancyType === 'WAREHOUSE' ||
      building.occupancyType === 'INDUSTRIAL_PROCESS' ||
      /حلال|تینر|مخزن|بنزین|نفت/.test(building.storedMaterials);
    compatibilityMatrix.push({
      fireClass: 'B',
      zoneName: 'مایعات و گازهای قابل اشتعال (هیدروکربن‌ها، حلال‌ها، روغن)',
      recommendedAgent: useFoam ? 'FOAM_AFFF' : 'ABC_DRY_POWDER',
      recommendedLabelFa: useFoam ? AGENT_LABELS_FA.FOAM_AFFF : AGENT_LABELS_FA.ABC_DRY_POWDER,
      recommendedCapacityFa: useFoam ? 'فوم ۵۰ لیتری چرخدار / ۹ لیتری + پودر ۱۲ کیلویی' : '۶ یا ۱۲ کیلوگرم پودر BC/ABC',
      recommendedRating: hazardGroup === 'EH1' || hazardGroup === 'EH2' ? '40-B:C / 80-B:C' : '20-B:C',
      forbiddenAgents: [
        {
          agent: 'WATER',
          labelFa: AGENT_LABELS_FA.WATER,
          reasonFa: 'پاشش آب روی مایعات سبک قابل اشتعال باعث پخش آتش، جوشش و تشدید حریق می‌شود.',
        },
      ],
      notesFa: 'حداکثر فاصله پیمایش در کاربری خطر عادی/فوق‌العاده با رتبه‌بندی کامل ۱۵.۲۵ متر (۵۰ فوت) است.',
    });
  }

  if (detectedFireClasses.includes('C')) {
    const cleanChoice: AgentType =
      extinguisherConfig.preferredCleanAgent === 'CLEAN_AGENT' || building.occupancyType === 'SERVER_ROOM'
        ? 'CLEAN_AGENT'
        : 'CO2';
    compatibilityMatrix.push({
      fireClass: 'C',
      zoneName: 'تجهیزات برقی برقدار، تابلو برق، سرور و اتاق کنترل',
      recommendedAgent: cleanChoice,
      recommendedLabelFa: AGENT_LABELS_FA[cleanChoice],
      recommendedCapacityFa: cleanChoice === 'CO2' ? '۶ کیلوگرم CO2' : '۵ تا ۹ کیلوگرم Clean Agent',
      recommendedRating: '10-B:C',
      forbiddenAgents: [
        {
          agent: 'WATER',
          labelFa: AGENT_LABELS_FA.WATER,
          reasonFa: 'خطر مرگبار برق‌گرفتگی اپراتور و اتصال کوتاه (NFPA 10 Sec. 5.5.2).',
        },
        {
          agent: 'FOAM_AFFF',
          labelFa: AGENT_LABELS_FA.FOAM_AFFF,
          reasonFa: 'فوم بر پایه آب و رسانای جریان برق است؛ استفاده روی تجهیزات برقدار اکیداً ممنوع است.',
        },
      ],
      notesFa:
        'استفاده از پودر ABC روی بردهای الکترونیکی، رک سرور و PLC موجب خوردگی شدید و ازکارافتادگی تجهیزات می‌شود.',
    });
  }

  if (detectedFireClasses.includes('D')) {
    compatibilityMatrix.push({
      fireClass: 'D',
      zoneName: 'فلزات قابل اشتعال (منیزیم، سدیم، پودر آلومینیوم، تیتانیوم)',
      recommendedAgent: 'CLASS_D_POWDER',
      recommendedLabelFa: AGENT_LABELS_FA.CLASS_D_POWDER,
      recommendedCapacityFa: '۹ تا ۱۲ کیلوگرم پودر تخصصی Class D',
      recommendedRating: 'Class D',
      forbiddenAgents: [
        {
          agent: 'WATER',
          labelFa: AGENT_LABELS_FA.WATER,
          reasonFa: 'واکنش شدید گرمازا و آزادسازی گاز هیدروژن قابل انفجار.',
        },
        {
          agent: 'CO2',
          labelFa: AGENT_LABELS_FA.CO2,
          reasonFa: 'تشدید واکنش اکسیداسیون با برخی فلزات فعال نظیر منیزیم.',
        },
        {
          agent: 'FOAM_AFFF',
          labelFa: AGENT_LABELS_FA.FOAM_AFFF,
          reasonFa: 'حاوی آب و موجب انفجار بخار در تماس با فلز مذاب می‌شود.',
        },
      ],
      notesFa: 'حداکثر فاصله پیمایش طبق NFPA 10 بند 6.5 برابر ۲۲.۹ متر (۷۵ فوت) از محل کار فلزات قابل اشتعال است.',
    });
  }

  if (detectedFireClasses.includes('K')) {
    compatibilityMatrix.push({
      fireClass: 'K',
      zoneName: 'روغن‌ها و چربی‌های پخت‌وپز (آشپزخانه صنعتی)',
      recommendedAgent: 'WET_CHEMICAL',
      recommendedLabelFa: AGENT_LABELS_FA.WET_CHEMICAL,
      recommendedCapacityFa: '۶ یا ۹ لیتر Wet Chemical',
      recommendedRating: '2-A:K',
      forbiddenAgents: [
        {
          agent: 'WATER',
          labelFa: AGENT_LABELS_FA.WATER,
          reasonFa: 'پاشش آب به روغن داغ موجب پرتاب انفجاری روغن سوزان (Boilover) می‌شود.',
        },
        {
          agent: 'ABC_DRY_POWDER',
          labelFa: AGENT_LABELS_FA.ABC_DRY_POWDER,
          reasonFa: 'فاقد اثر صابونی‌سازی و خنک‌کنندگی پایدار روغن؛ احتمال شعله‌وری مجدد.',
        },
      ],
      notesFa: 'حداکثر فاصله پیمایش طبق NFPA 10 بند 6.6 برابر ۹.۱۵ متر (۳۰ فوت) است.',
    });
  }

  // Determine effective travel distance limit for the floor
  const effectiveTravelLimitM = detectedFireClasses.includes('K')
    ? 9.15
    : detectedFireClasses.includes('B')
      ? maxTravelDistanceClassBM
      : maxTravelDistanceClassAM;

  // Quantity calculation combining Area coverage (Class A) AND Travel distance geometry (2D reach)
  const areaUnitsNeededA = Math.ceil(floor.areaSqm / Math.min(1045, maxAreaPerUnitClassASqm * 3)); // assuming 3-A or 4-A unit
  const geometricCellsX = Math.max(1, Math.ceil(floor.lengthM / (effectiveTravelLimitM * 1.45)));
  const geometricCellsY = Math.max(1, Math.ceil(floor.widthM / (effectiveTravelLimitM * 1.45)));
  const geometricMinimum = geometricCellsX * geometricCellsY;

  // Also ensure every isolated/partitioned space has at least 1 extinguisher
  const spaceCountFloor = Math.max(1, (floor.spaces || []).length);
  const baseExtCount = Math.max(2, areaUnitsNeededA, geometricMinimum, spaceCountFloor);

  const primaryDecision = compatibilityMatrix[0];
  const recommendedPrimaryAgent: AgentType = primaryDecision?.recommendedAgent || 'ABC_DRY_POWDER';

  // Allocate extinguishers by hazard class requirements (deduplicated by AgentType so multi-purpose agents like ABC are never duplicated)
  const allocationByAgent: FloorCalculationResult['extinguisher']['allocationByAgent'] = [];
  if (primaryDecision) {
    const distinctSpecializedMap = new Map<AgentType, AgentCompatibilityDecision[]>();
    for (const spec of compatibilityMatrix.slice(1)) {
      if (spec.recommendedAgent === primaryDecision.recommendedAgent) continue;
      const list = distinctSpecializedMap.get(spec.recommendedAgent) || [];
      list.push(spec);
      distinctSpecializedMap.set(spec.recommendedAgent, list);
    }

    const sameAsPrimaryNotes = compatibilityMatrix
      .slice(1)
      .filter((s) => s.recommendedAgent === primaryDecision.recommendedAgent)
      .map((s) => `کلاس ${s.fireClass}`);

    if (distinctSpecializedMap.size === 0) {
      allocationByAgent.push({
        agent: primaryDecision.recommendedAgent,
        labelFa: primaryDecision.recommendedLabelFa,
        rating: primaryDecision.recommendedRating,
        capacityFa: primaryDecision.recommendedCapacityFa,
        requiredCount: baseExtCount,
        mountingLocationFa:
          sameAsPrimaryNotes.length > 0
            ? `مسیرهای خروج، نقاط دسترسی اصلی و پوشش ${sameAsPrimaryNotes.join(' و ')}`
            : 'مسیرهای خروج و نقاط دسترسی اصلی طبقه',
      });
    } else {
      const specializedCountEach = Math.max(1, Math.ceil(baseExtCount * 0.35));
      const primaryCount = Math.max(1, baseExtCount - distinctSpecializedMap.size);
      allocationByAgent.push({
        agent: primaryDecision.recommendedAgent,
        labelFa: primaryDecision.recommendedLabelFa,
        rating: primaryDecision.recommendedRating,
        capacityFa: primaryDecision.recommendedCapacityFa,
        requiredCount: primaryCount,
        mountingLocationFa:
          sameAsPrimaryNotes.length > 0
            ? `مسیرهای خروج، توزیع سطح طبقه و پوشش ${sameAsPrimaryNotes.join(' و ')}`
            : 'مسیرهای خروج و توزیع یکنواخت سطح طبقه',
      });

      distinctSpecializedMap.forEach((specs, agent) => {
        const firstSpec = specs[0];
        const zoneNames = specs.map((s) => s.zoneName).join(' / ');
        allocationByAgent.push({
          agent,
          labelFa: firstSpec.recommendedLabelFa,
          rating: firstSpec.recommendedRating,
          capacityFa: firstSpec.recommendedCapacityFa,
          requiredCount: specializedCountEach,
          mountingLocationFa: `نزدیک زون ${zoneNames}`,
        });
      });
    }
  }

  const requiredTotalCount = allocationByAgent.reduce((s, a) => s + a.requiredCount, 0);

  // =========================================================================
  // PLACEMENT & SPATIAL BLIND-SPOT ANALYSIS
  // =========================================================================
  const suggestedItems = generateSuggestedPlacement(
    building,
    floor,
    hazardSpec,
    needsSprinkler,
    allocationByAgent,
    effectiveTravelLimitM,
    kFactor,
    recommendedHeadLabelFa
  );

  const activeItems =
    params.placedItems && params.placedItems.length > 0 ? params.placedItems : suggestedItems;

  const placedSprinklerCount = activeItems.filter(
    (p) => p.kind === 'SPRINKLER_PROPOSED' || p.kind === 'SPRINKLER_EXISTING'
  ).length;
  const placedExtinguisherCount = activeItems.filter(
    (p) => p.kind === 'EXTINGUISHER_PROPOSED' || p.kind === 'EXTINGUISHER_EXISTING'
  ).length;

  const spatial = analyzeSpatialCoverage(
    floor,
    activeItems,
    needsSprinkler,
    designSpacingXM,
    designSpacingYM,
    effectiveTravelLimitM
  );
  const overDensity = detectOverDensityConflicts(activeItems);

  // =========================================================================
  // EXISTING EQUIPMENT VS REQUIRED COMPARISON
  // =========================================================================
  const unitFilterNorm = (building.unitName || '').trim().toLowerCase();
  const buildingNameNorm = (building.name || '').trim().toLowerCase();
  const floorLabelNorm = (floor.floorLabel || '').trim().toLowerCase();
  const floorCodeNorm = (floor.floorCode || '').trim().toLowerCase();

  const matchingExisting = existingEquipment.filter((eq) => {
    if (eq.operationalStatus === 'غیرفعال') return false;
    const eqUnit = `${eq.unit || ''} ${eq.location || ''} ${eq.complex || ''}`.toLowerCase();
    const matchesBuilding =
      (unitFilterNorm && eqUnit.includes(unitFilterNorm)) ||
      (buildingNameNorm && eqUnit.includes(buildingNameNorm));
    if (!matchesBuilding) return false;
    const eqFloor = (eq.floor || '').trim().toLowerCase();
    if (!eqFloor) return true; // if floor tag wasn't specified in inventory, include at unit level
    return (
      eqFloor === floorLabelNorm ||
      eqFloor === floorCodeNorm ||
      floorLabelNorm.includes(eqFloor) ||
      eqFloor.includes(floorCodeNorm)
    );
  });

  const comparisonRows: EquipmentComparisonRow[] = [];

  // 1) Sprinklers / Deluge comparison
  if (needsSprinkler) {
    const existingSpItems = matchingExisting.filter((e) => e.category === 'دليج ولواسپرينكلرon,off ولو');
    const pinnedExistingSp = activeItems.filter((p) => p.kind === 'SPRINKLER_EXISTING').length;
    const existingCount = Math.max(existingSpItems.length, pinnedExistingSp);
    const deficit = Math.max(0, calculatedHeadCount - existingCount);
    const surplus = Math.max(0, existingCount - calculatedHeadCount);
    comparisonRows.push({
      categoryKey: 'SPRINKLER',
      categoryTitleFa: 'اسپرینکلر / نازل شبکه اطفای سقفی',
      agentOrType: recommendedHeadLabelFa,
      existingCount,
      requiredCount: calculatedHeadCount,
      deficitCount: deficit,
      surplusCount: surplus,
      incompatibleCount: 0,
      incompatibleReasons: [],
      status: deficit > 0 ? 'DEFICIT' : surplus > 0 ? 'SURPLUS' : 'ADEQUATE',
    });
  }

  // 2) Extinguishers comparison + Incompatibility detection
  const existingExts = matchingExisting.filter((e) => e.category === 'Fire Extinguisher Capsol');
  const forbiddenAgentsAll = new Set<AgentType>();
  compatibilityMatrix.forEach((c) => c.forbiddenAgents.forEach((f) => forbiddenAgentsAll.add(f.agent)));

  const existingByAgent = new Map<AgentType, ExistingEquipmentSummaryItem[]>();
  for (const ex of existingExts) {
    const ag = classifyExistingExtinguisherAgent(ex.type);
    const arr = existingByAgent.get(ag) || [];
    arr.push(ex);
    existingByAgent.set(ag, arr);
  }

  for (const alloc of allocationByAgent) {
    const matched = existingByAgent.get(alloc.agent) || [];
    const existingCount = matched.length;
    const deficit = Math.max(0, alloc.requiredCount - existingCount);
    const surplus = Math.max(0, existingCount - alloc.requiredCount);
    comparisonRows.push({
      categoryKey: `EXT_${alloc.agent}`,
      categoryTitleFa: `خاموش‌کننده ${alloc.labelFa}`,
      agentOrType: `${alloc.capacityFa} (${alloc.rating})`,
      existingCount,
      requiredCount: alloc.requiredCount,
      deficitCount: deficit,
      surplusCount: surplus,
      incompatibleCount: 0,
      incompatibleReasons: [],
      status: deficit > 0 ? 'DEFICIT' : surplus > 0 ? 'SURPLUS' : 'ADEQUATE',
    });
  }

  // Flag any existing incompatible extinguishers installed in this unit/floor
  existingByAgent.forEach((itemsList, ag) => {
    const isAllocated = allocationByAgent.some((a) => a.agent === ag);
    if (!isAllocated && forbiddenAgentsAll.has(ag)) {
      const reasons = compatibilityMatrix
        .flatMap((c) => c.forbiddenAgents)
        .filter((f) => f.agent === ag)
        .map((f) => f.reasonFa);
      comparisonRows.push({
        categoryKey: `EXT_INCOMPAT_${ag}`,
        categoryTitleFa: `تجهیز ناسازگار موجود (${AGENT_LABELS_FA[ag]})`,
        agentOrType: itemsList.map((i) => i.code).slice(0, 5).join(', '),
        existingCount: itemsList.length,
        requiredCount: 0,
        deficitCount: 0,
        surplusCount: 0,
        incompatibleCount: itemsList.length,
        incompatibleReasons: Array.from(new Set(reasons)),
        status: 'INCOMPATIBLE',
      });
    }
  });

  // =========================================================================
  // COMPLIANCE CHECKS SUMMARY (NFPA 13 & NFPA 10)
  // =========================================================================
  const complianceChecks: ComplianceCheckItem[] = [];

  complianceChecks.push({
    id: 'n13-hazard',
    standard: 'NFPA 13',
    edition: nfpa13Edition,
    clause: n13Ref.densityRef,
    titleFa: 'طبقه‌بندی خطر و چگالی طراحی',
    status: 'PASS',
    detailFa: `${hazardSpec.labelFa} — چگالی ${designDensityGpmSqft} gpm/ft² (${designDensityMmMin} mm/min) در مساحت بحرانی ${hydraulics.remoteAreaSqft} ft².`,
  });

  if (needsSprinkler) {
    complianceChecks.push({
      id: 'n13-spacing',
      standard: 'NFPA 13',
      edition: nfpa13Edition,
      clause: n13Ref.spacingRef,
      titleFa: 'فواصل جانمایی و پوشش اسپرینکلر',
      status:
        overDensity.count > 0
          ? 'WARNING'
          : spatial.sprinklerCoveragePercent >= 95 &&
              designSpacingXM <= hazardSpec.maxSpacingM &&
              designSpacingYM <= hazardSpec.maxSpacingM
            ? 'PASS'
            : 'WARNING',
      detailFa:
        overDensity.count > 0
          ? `فاصله شبکه ${designSpacingXM}×${designSpacingYM} متر — هشدار ${overDensity.count} مورد فاصله کمتر از ۱.۸m (Cold Soldering).`
          : `فاصله شبکه ${designSpacingXM}×${designSpacingYM} متر (حداکثر مجاز ${hazardSpec.maxSpacingM}m) — پوشش فضایی ${spatial.sprinklerCoveragePercent}٪.`,
    });

    complianceChecks.push({
      id: 'n13-obstruction',
      standard: 'NFPA 13',
      edition: nfpa13Edition,
      clause: n13Ref.obstructionRef,
      titleFa: 'بررسی موانع سازه‌ای، تیرها و سقف کاذب',
      status: obstructionAlerts.length === 0 ? 'PASS' : 'WARNING',
      detailFa:
        obstructionAlerts.length === 0
          ? 'سقف بدون مانع ساختاری قابل توجه تشخیص داده شد.'
          : obstructionAlerts[0],
    });

    complianceChecks.push({
      id: 'n13-water',
      standard: 'NFPA 13',
      edition: nfpa13Edition,
      clause: n13Ref.hydraulicRef,
      titleFa:
        sourceTypeUsed === 'FIRE_NETWORK'
          ? 'ارزیابی شبکه آب و بوسترپمپ آتش‌نشانی'
          : 'ارزیابی مخزن آب و بوسترپمپ آتش‌نشانی',
      status:
        waterSupplyStatus === 'ADEQUATE'
          ? 'PASS'
          : waterSupplyStatus === 'INADEQUATE'
            ? 'FAIL'
            : 'INCOMPLETE',
      detailFa: `${tankCheckDetailFa} | ${pumpCheckDetailFa}`,
    });
  } else {
    complianceChecks.push({
      id: 'n13-alt',
      standard: 'NFPA 13',
      edition: nfpa13Edition,
      clause: 'NFPA 13 / NFPA 2001 / NFPA 484',
      titleFa: 'انطباق سیستم اطفای سقفی با ماهیت خطر',
      status: 'WARNING',
      detailFa: suppressionAlternativeNoteFa || 'استفاده از سیستم اطفای غیرآبی توصیه می‌شود.',
    });
  }

  complianceChecks.push({
    id: 'n10-travel',
    standard: 'NFPA 10',
    edition: nfpa10Edition,
    clause: detectedFireClasses.includes('B') ? n10Ref.classBRef : n10Ref.classARef,
    titleFa: 'کنترل فاصله پیمایش واقعی خاموش‌کننده‌ها',
    status:
      spatial.extinguisherCoveragePercent >= 95 &&
      spatial.maxObservedTravelM <= effectiveTravelLimitM
        ? 'PASS'
        : 'FAIL',
    detailFa: `حداکثر فاصله پیمایش مجاز ${effectiveTravelLimitM} متر | بیشترین فاصله مشاهده‌شده ${spatial.maxObservedTravelM} متر | پوشش ${spatial.extinguisherCoveragePercent}٪.`,
  });

  const hasIncompatible = comparisonRows.some((r) => r.incompatibleCount > 0);
  complianceChecks.push({
    id: 'n10-compat',
    standard: 'NFPA 10',
    edition: nfpa10Edition,
    clause: n10Ref.compatibilityRef,
    titleFa: 'سازگاری شیمیایی و الکتریکی عامل اطفا با کلاس حریق',
    status: hasIncompatible ? 'FAIL' : 'PASS',
    detailFa: hasIncompatible
      ? 'در تجهیزات موجود این بخش خاموش‌کننده ناسازگار با کلاس خطر شناسایی شد (نیازمند جایگزینی فوری).'
      : `عامل‌های پیشنهادی با کلاس‌های حریق (${detectedFireClasses.join('، ')}) کاملاً سازگار هستند.`,
  });

  const warnings: string[] = [...obstructionAlerts, ...overDensity.alerts];
  if (suppressionAlternativeNoteFa) warnings.unshift(suppressionAlternativeNoteFa);
  if (hasIncompatible) {
    warnings.push('هشدار ایمنی: تجهیزات خاموش‌کننده ناسازگار موجود در سیستم بازرسی یافت شد.');
  }
  if (spatial.uncoveredZones.length > 0) {
    warnings.push(
      `تعداد ${spatial.uncoveredZones.length} نقطه کور / محدوده فاقد پوشش استاندارد در پلان شناسایی شد.`
    );
  }

  const passedChecksCount = complianceChecks.filter((c) => c.status === 'PASS').length;
  const checkScore = complianceChecks.length > 0 ? (passedChecksCount / complianceChecks.length) * 100 : 100;
  const spatialScore = needsSprinkler
    ? (spatial.sprinklerCoveragePercent + spatial.extinguisherCoveragePercent) / 2
    : spatial.extinguisherCoveragePercent;
  const penalty = (hasIncompatible ? 12 : 0) + Math.min(10, overDensity.count * 3);
  const overallCompliancePercent = Math.max(
    0,
    Math.min(100, Math.round(spatialScore * 0.55 + checkScore * 0.45 - penalty))
  );

  return {
    calculationStatus:
      validation.missingWaterFields.length > 0 && needsSprinkler ? 'PARTIAL_WATER_DATA' : 'COMPLETE',
    missingRequiredFields: [],
    warnings,
    nfpa13Edition,
    nfpa10Edition,
    hazardGroup,
    hazardGroupLabelFa: hazardSpec.labelFa,
    hazardBasisCitation: basisCitation,
    detectedFireClasses,
    overallCompliancePercent,
    sprinkler: {
      isRequiredOrRecommended: needsSprinkler,
      suppressionAlternativeNoteFa,
      recommendedHeadType,
      recommendedHeadLabelFa,
      kFactor,
      tempRatingC,
      maxCoveragePerHeadSqm: hazardSpec.maxAreaPerHeadSqm,
      maxSpacingM: hazardSpec.maxSpacingM,
      minSpacingM: hazardSpec.minSpacingM,
      maxWallDistanceM: Number((hazardSpec.maxSpacingM / 2).toFixed(2)),
      designSpacingXM,
      designSpacingYM,
      calculatedHeadCount,
      placedSprinklerCount,
      coveragePercent: spatial.sprinklerCoveragePercent,
      overDensityConflicts: overDensity.count,
      obstructionAlerts,
      hydraulics,
    },
    extinguisher: {
      maxTravelDistanceClassAM,
      maxTravelDistanceClassBM,
      maxAreaPerUnitClassASqm,
      recommendedPrimaryAgent,
      requiredTotalCount,
      placedExtinguisherCount,
      coveragePercent: spatial.extinguisherCoveragePercent,
      maxObservedTravelM: spatial.maxObservedTravelM,
      compatibilityMatrix,
      allocationByAgent,
    },
    uncoveredZones: spatial.uncoveredZones,
    comparisonRows,
    complianceChecks,
    suggestedItems,
    engineeringDisclaimerFa: ENGINEERING_DISCLAIMER_FA,
  };
}
