import type { FireDesignBuilding, WaterSourceType, WaterSupplyInput } from './types';

export const WATER_SOURCE_OPTIONS: {
  value: WaterSourceType;
  titleFa: string;
  subtitleFa: string;
}[] = [
  {
    value: 'FIRE_NETWORK',
    titleFa: 'شبکه آب آتش‌نشانی',
    subtitleFa: 'تأمین مستقیم از رینگ/شبکه تحت فشار آب آتش‌نشانی (بدون مخزن ذخیره اختصاصی)',
  },
  {
    value: 'STORAGE_TANK',
    titleFa: 'مخزن ذخیره آب آتش‌نشانی',
    subtitleFa: 'تأمین از مخزن ذخیره اختصاصی (با امکان بوسترپمپ و اتصال پشتیبان به شبکه)',
  },
];

export function toNullablePositiveNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Infers the water source type from structured column, JSONB field, or legacy data.
 * Never invents fake values; falls back cleanly for legacy rows without data loss.
 */
export function inferLegacyWaterSourceType(
  buildingOrWs?: Partial<FireDesignBuilding> | WaterSupplyInput | null
): WaterSourceType | null {
  if (!buildingOrWs) return null;
  const asBuilding = buildingOrWs as Partial<FireDesignBuilding>;
  const ws: WaterSupplyInput =
    'waterSupply' in asBuilding && asBuilding.waterSupply && typeof asBuilding.waterSupply === 'object'
      ? asBuilding.waterSupply
      : (buildingOrWs as WaterSupplyInput);

  if (asBuilding.waterSourceType === 'FIRE_NETWORK' || asBuilding.waterSourceType === 'STORAGE_TANK') {
    return asBuilding.waterSourceType;
  }
  if (ws.sourceType === 'FIRE_NETWORK' || ws.sourceType === 'STORAGE_TANK') {
    return ws.sourceType;
  }
  if (toNullablePositiveNumber(ws.tankCapacityLiters) !== null) {
    return 'STORAGE_TANK';
  }
  if (
    toNullablePositiveNumber(ws.staticPressureBar) !== null ||
    toNullablePositiveNumber(ws.residualPressureBar) !== null
  ) {
    return 'FIRE_NETWORK';
  }
  return null;
}

export function resolveWaterSourceType(
  buildingOrWs?: Partial<FireDesignBuilding> | WaterSupplyInput | null,
  fallback: WaterSourceType = 'STORAGE_TANK'
): WaterSourceType {
  return inferLegacyWaterSourceType(buildingOrWs) ?? fallback;
}

export function resolveHasFirePump(ws?: WaterSupplyInput | null): boolean | null {
  if (!ws) return null;
  if (typeof ws.hasFirePump === 'boolean') return ws.hasFirePump;
  if (
    toNullablePositiveNumber(ws.pumpRatedFlowGpm) !== null ||
    toNullablePositiveNumber(ws.pumpRatedPressureBar) !== null
  ) {
    return true;
  }
  return null;
}

export function resolveHasNetworkConnection(
  ws: WaterSupplyInput | null | undefined,
  sourceType: WaterSourceType
): boolean {
  if (sourceType === 'FIRE_NETWORK') return true;
  if (!ws) return false;
  if (typeof ws.hasNetworkConnection === 'boolean') return ws.hasNetworkConnection;
  return (
    toNullablePositiveNumber(ws.staticPressureBar) !== null ||
    toNullablePositiveNumber(ws.residualPressureBar) !== null
  );
}

/**
 * Normalizes and sanitizes waterSupply payload before DB persistence.
 * Ensures fields unrelated to the active source/configuration are saved strictly as `null` (never 0 or fake defaults).
 */
export function sanitizeWaterSupply(
  rawWs: Partial<WaterSupplyInput> | null | undefined,
  explicitSourceType?: WaterSourceType | null
): {
  waterSourceType: WaterSourceType;
  waterSupply: WaterSupplyInput;
} {
  const ws = rawWs && typeof rawWs === 'object' ? rawWs : {};
  const sourceType: WaterSourceType =
    explicitSourceType === 'FIRE_NETWORK' || explicitSourceType === 'STORAGE_TANK'
      ? explicitSourceType
      : resolveWaterSourceType(ws, 'FIRE_NETWORK');

  const inferredPump = resolveHasFirePump(ws);
  const hasFirePump = inferredPump ?? false;
  const hasNetworkConnection = resolveHasNetworkConnection(ws, sourceType);

  const validPipeMaterial =
    ws.pipeMaterial === 'BLACK_STEEL_WET' ||
    ws.pipeMaterial === 'BLACK_STEEL_DRY' ||
    ws.pipeMaterial === 'GALVANIZED' ||
    ws.pipeMaterial === 'CPVC_COPPER'
      ? ws.pipeMaterial
      : 'BLACK_STEEL_WET';

  const cleaned: WaterSupplyInput = {
    sourceType,
    hasFirePump,
    hasNetworkConnection,
    isAvailable: ws.isAvailable === false && !explicitSourceType && !ws.sourceType ? false : true,
    tankCapacityLiters: sourceType === 'STORAGE_TANK' ? toNullablePositiveNumber(ws.tankCapacityLiters) : null,
    pumpRatedFlowGpm: hasFirePump ? toNullablePositiveNumber(ws.pumpRatedFlowGpm) : null,
    pumpRatedPressureBar: hasFirePump ? toNullablePositiveNumber(ws.pumpRatedPressureBar) : null,
    staticPressureBar: hasNetworkConnection ? toNullablePositiveNumber(ws.staticPressureBar) : null,
    residualPressureBar: hasNetworkConnection ? toNullablePositiveNumber(ws.residualPressureBar) : null,
    riserDiameterMm: toNullablePositiveNumber(ws.riserDiameterMm),
    pipeMaterial: validPipeMaterial,
    cFactor: toNullablePositiveNumber(ws.cFactor),
    hoseStreamAllowanceGpm: toNullablePositiveNumber(ws.hoseStreamAllowanceGpm),
    supplyDurationMin: toNullablePositiveNumber(ws.supplyDurationMin),
  };

  return {
    waterSourceType: sourceType,
    waterSupply: cleaned,
  };
}

/**
 * Returns labels of previously entered/stored fields that are incompatible with the currently selected configuration
 * and will be persisted as NULL upon saving.
 */
export function getConflictingWaterFieldWarnings(
  ws: Partial<WaterSupplyInput> | null | undefined,
  sourceType: WaterSourceType,
  hasFirePump: boolean,
  hasNetworkConnection: boolean
): string[] {
  if (!ws) return [];
  const conflicts: string[] = [];

  if (sourceType === 'FIRE_NETWORK' && toNullablePositiveNumber(ws.tankCapacityLiters) !== null) {
    conflicts.push(
      `حجم مخزن ذخیره آب (${Number(ws.tankCapacityLiters).toLocaleString()} لیتر)`
    );
  }
  if (sourceType === 'STORAGE_TANK' && !hasNetworkConnection) {
    if (toNullablePositiveNumber(ws.staticPressureBar) !== null) {
      conflicts.push(`فشار استاتیک شبکه (${ws.staticPressureBar} Bar)`);
    }
    if (toNullablePositiveNumber(ws.residualPressureBar) !== null) {
      conflicts.push(`فشار باقیمانده شبکه (${ws.residualPressureBar} Bar)`);
    }
  }
  if (!hasFirePump) {
    if (toNullablePositiveNumber(ws.pumpRatedFlowGpm) !== null) {
      conflicts.push(`دبی نامی پمپ (${ws.pumpRatedFlowGpm} GPM)`);
    }
    if (toNullablePositiveNumber(ws.pumpRatedPressureBar) !== null) {
      conflicts.push(`فشار نامی پمپ (${ws.pumpRatedPressureBar} Bar)`);
    }
  }

  return conflicts;
}
