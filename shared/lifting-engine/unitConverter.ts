/**
 * Pure SI Unit Conversion & Numeric Safety Layer for HSECORE Lifting Engine
 * Canonical Internal Engineering Units (SI):
 * - Mass: metric ton (t = 1,000 kg) and kg
 * - Force: kilonewton (kN, 1 tf = 9.80665 kN)
 * - Length: meter (m)
 * - Pressure / Bearing: kilopascal (kPa, 1 MPa = 1,000 kPa)
 * - Velocity (Wind): meter per second (m/s)
 * - Angle: degrees (deg)
 */

export const GRAVITY_MPS2 = 9.80665;

export type MassUnit = 'ton' | 'kg' | 'lb';
export type LengthUnit = 'm' | 'mm' | 'cm' | 'ft' | 'in';
export type PressureUnit = 'kPa' | 'MPa' | 'bar' | 'psi';
export type WindSpeedUnit = 'm/s' | 'km/h' | 'mph' | 'knot';
export type ForceUnit = 'kN' | 'tonf' | 'N' | 'lbf';

export interface LiftingUnitPreferences {
  massUnit: MassUnit;
  lengthUnit: LengthUnit;
  pressureUnit: PressureUnit;
  windUnit: WindSpeedUnit;
}

export const DEFAULT_UNIT_PREFERENCES: LiftingUnitPreferences = {
  massUnit: 'ton',
  lengthUnit: 'm',
  pressureUnit: 'kPa',
  windUnit: 'm/s',
};

const MASS_TO_TON: Record<MassUnit, number> = {
  ton: 1,
  kg: 0.001,
  lb: 0.00045359237,
};

const LENGTH_TO_M: Record<LengthUnit, number> = {
  m: 1,
  mm: 0.001,
  cm: 0.01,
  ft: 0.3048,
  in: 0.0254,
};

const PRESSURE_TO_KPA: Record<PressureUnit, number> = {
  kPa: 1,
  MPa: 1000,
  bar: 100,
  psi: 6.894757293168361,
};

const WIND_TO_MPS: Record<WindSpeedUnit, number> = {
  'm/s': 1,
  'km/h': 1 / 3.6,
  mph: 0.44704,
  knot: 0.5144444444444445,
};

const FORCE_TO_KN: Record<ForceUnit, number> = {
  kN: 1,
  tonf: GRAVITY_MPS2,
  N: 0.001,
  lbf: 0.0044482216152605,
};

export function toMetricTon(value: number, from: MassUnit = 'ton'): number {
  if (!Number.isFinite(value)) return NaN;
  return value * MASS_TO_TON[from];
}

export function fromMetricTon(tonValue: number, to: MassUnit = 'ton'): number {
  if (!Number.isFinite(tonValue)) return NaN;
  return tonValue / MASS_TO_TON[to];
}

export function toMeters(value: number, from: LengthUnit = 'm'): number {
  if (!Number.isFinite(value)) return NaN;
  return value * LENGTH_TO_M[from];
}

export function fromMeters(meterValue: number, to: LengthUnit = 'm'): number {
  if (!Number.isFinite(meterValue)) return NaN;
  return meterValue / LENGTH_TO_M[to];
}

export function toKpa(value: number, from: PressureUnit = 'kPa'): number {
  if (!Number.isFinite(value)) return NaN;
  return value * PRESSURE_TO_KPA[from];
}

export function fromKpa(kpaValue: number, to: PressureUnit = 'kPa'): number {
  if (!Number.isFinite(kpaValue)) return NaN;
  return kpaValue / PRESSURE_TO_KPA[to];
}

export function toMetersPerSec(value: number, from: WindSpeedUnit = 'm/s'): number {
  if (!Number.isFinite(value)) return NaN;
  return value * WIND_TO_MPS[from];
}

export function fromMetersPerSec(mpsValue: number, to: WindSpeedUnit = 'm/s'): number {
  if (!Number.isFinite(mpsValue)) return NaN;
  return mpsValue / WIND_TO_MPS[to];
}

export function toKilonewtons(value: number, from: ForceUnit = 'kN'): number {
  if (!Number.isFinite(value)) return NaN;
  return value * FORCE_TO_KN[from];
}

export function fromKilonewtons(knValue: number, to: ForceUnit = 'kN'): number {
  if (!Number.isFinite(knValue)) return NaN;
  return knValue / FORCE_TO_KN[to];
}

export function isValidPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function isValidNonNegativeFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * Display rounding ONLY — never use inside intermediate physical calculations.
 */
export function roundDisplay(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}
