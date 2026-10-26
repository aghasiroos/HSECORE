import { sql } from 'drizzle-orm';
import { db, withDbRetry } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';

function div(a: number, b: number) {
  return Math.floor(a / b);
}

/**
 * Converts Gregorian date (year, month 1-12, day) to Jalali [jy, jm, jd].
 */
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let jm: number, jd: number;
  if (days < 186) {
    jm = 1 + div(days, 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + div(days - 186, 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

/**
 * Calculates the Jalali year for a given date input or current time.
 */
export function getJalaliYear(dateInput?: Date | string | number): number {
  if (!dateInput) {
    const now = new Date();
    return toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())[0];
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Check if it's already a Jalali date string starting with 13xx or 14xx
    const jMatch = trimmed.match(/^1[34]\d{2}/);
    if (jMatch) {
      return parseInt(jMatch[0], 10);
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())[0];
  }

  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())[0];
}

/**
 * Standard 2-letter abbreviation mapping for permit types & categories.
 */
export function getPermitTypeCode(permitType?: string, permitCategory?: string): string {
  const normType = String(permitType || '').trim().toUpperCase();
  const normCat = String(permitCategory || '').trim().toUpperCase();

  const combined = `${normType} ${normCat}`;

  if (combined.includes('HOT') || combined.includes('گرم')) return 'HW';
  if (combined.includes('COLD') || combined.includes('سرد')) return 'CW';
  if (combined.includes('EXCAV') || combined.includes('حفاری')) return 'EX';
  if (combined.includes('PROCESS') || combined.includes('MECHANICAL') || combined.includes('مکانیکی') || combined.includes('فرآیندی')) return 'PM';
  if (combined.includes('CONFINED') || combined.includes('SPACE') || combined.includes('فضای بسته')) return 'CS';
  if (combined.includes('ELEC') || combined.includes('برق') || combined.includes('الکتریکی')) return 'EL';
  if (combined.includes('RAD') || combined.includes('پرتو')) return 'RA';
  if (combined.includes('CRANE') || combined.includes('VEHICLE') || combined.includes('جرثقیل') || combined.includes('خودرو')) return 'VC';
  if (combined.includes('HEIGHT') || combined.includes('ارتفاع')) return 'WA';
  if (combined.includes('SCAFFOLD') || combined.includes('داربست')) return 'SC';

  // Default fallback
  return 'SU';
}

/**
 * Determines whether a permit is supplementary.
 */
export function isSupplementaryPermit(permitCategory?: string, parentPermitNumber?: string, permitType?: string): boolean {
  if (parentPermitNumber && parentPermitNumber.trim().length > 0) return true;

  const normCat = String(permitCategory || '').trim();
  const suppCategories = [
    'Excavation',
    'ProcessMechanical',
    'ConfinedSpace',
    'ElectricalIsolation',
    'Radiation',
    'VehicleCrane',
    'Height',
    'Scaffolding'
  ];

  if (suppCategories.includes(normCat)) return true;

  const normType = String(permitType || '').trim().toUpperCase();
  if (['EXCAVATION', 'CONFINED_SPACE', 'ELECTRICAL', 'RADIATION', 'MECHANICAL'].includes(normType)) {
    return true;
  }

  return false;
}

let isTableInitialized = false;

/**
 * Ensures the permit_number_counters table & indexes exist in پایگاه داده.
 */
export async function ensurePermitTablesExist(): Promise<void> {
  if (isTableInitialized) return;

  try {
    await withDbRetry(async () => {
      // 1. Create work_permits base table without brittle foreign keys
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS work_permits (
            id SERIAL PRIMARY KEY,
            permit_number TEXT NOT NULL UNIQUE,
            permit_type TEXT NOT NULL,
            title TEXT NOT NULL,
            location TEXT NOT NULL,
            status TEXT DEFAULT 'DRAFT' NOT NULL,
            valid_from TEXT NOT NULL,
            valid_to TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          );
        `);
      } catch (e) {
        // Table creation notice
      }

      // 2. Ensure all columns exist individually
      const alterColumns = [
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS company_id INTEGER;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS unit_id INTEGER;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS description TEXT;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS hazards JSONB;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS precautions JSONB;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS issuer_id INTEGER;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS acceptor_id INTEGER;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS contractor_name TEXT;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS worker_count INTEGER DEFAULT 1;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS equipment_list TEXT;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS parent_permit_number TEXT;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS permit_category TEXT;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS sequence_number INTEGER;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS jalali_year INTEGER;`,
        `ALTER TABLE work_permits ADD COLUMN IF NOT EXISTS form_data JSONB;`
      ];

      for (const colStmt of alterColumns) {
        try {
          await db.execute(sql.raw(colStmt));
        } catch {
          // Column may already exist
        }
      }

      // 3. Create permit_number_counters
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS permit_number_counters (
            id SERIAL PRIMARY KEY,
            jalali_year INTEGER NOT NULL,
            permit_type_code TEXT NOT NULL,
            parent_permit_number TEXT DEFAULT '' NOT NULL,
            last_sequence INTEGER DEFAULT 0 NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
          );
        `);
      } catch {
        // Table creation notice
      }

      try {
        await db.execute(sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_permit_counters_unique 
          ON permit_number_counters (jalali_year, permit_type_code, parent_permit_number);
        `);
      } catch {
        // Index creation notice
      }
    });
    isTableInitialized = true;
  } catch (err) {
    console.error('[PermitNumberService] Table check error:', err);
  }
}

export interface GeneratePermitNumberParams {
  permitType?: string;
  permitCategory?: string;
  parentPermitNumber?: string;
  issueDate?: Date | string | number;
}

export interface GeneratedPermitNumberResult {
  permitNumber: string;
  sequenceNumber: number;
  jalaliYear: number;
  permitTypeCode: string;
  isSupplementary: boolean;
  parentPermitNumber?: string;
}

/**
 * Atomically generates a unique permit number in پایگاه داده.
 * Format Main:          HW-1405-000001 (6 digits sequence)
 * Format Supplementary: HW-1405-000001-EX0001 (4 digits sequence linked to main)
 * Standalone Supp:     EX-1405-0001 (4 digits sequence)
 */
export async function generateNextPermitNumber(
  params: GeneratePermitNumberParams
): Promise<GeneratedPermitNumberResult> {
  await ensurePermitTablesExist();

  const parentPermitNum = (params.parentPermitNumber || '').trim();
  const isSupp = isSupplementaryPermit(params.permitCategory, parentPermitNum, params.permitType);
  const jalaliYear = getJalaliYear(params.issueDate);
  const typeCode = getPermitTypeCode(params.permitType, params.permitCategory);

  let lastSeq = 1;

  try {
    const res = await withDbRetry(async () => {
      return await db.execute(sql`
        INSERT INTO permit_number_counters (jalali_year, permit_type_code, parent_permit_number, last_sequence, updated_at)
        VALUES (${jalaliYear}, ${typeCode}, ${parentPermitNum}, 1, NOW())
        ON CONFLICT (jalali_year, permit_type_code, parent_permit_number)
        DO UPDATE SET 
          last_sequence = permit_number_counters.last_sequence + 1,
          updated_at = NOW()
        RETURNING last_sequence;
      `);
    });

    if (res && res.rows && res.rows.length > 0) {
      lastSeq = Number(res.rows[0].last_sequence);
    }
  } catch (err) {
    console.error('[PermitNumberService] Error incrementing sequence:', err);
    // Secondary fallback: select max existing sequence from work_permits table
    try {
      const existing = await db
        .select({ seq: schema.workPermits.sequenceNumber })
        .from(schema.workPermits)
        .where(
          sql`${schema.workPermits.jalaliYear} = ${jalaliYear}`
        );
      const maxSeq = existing.reduce((max, r) => Math.max(max, Number(r.seq || 0)), 0);
      lastSeq = maxSeq + 1;
    } catch {
      lastSeq = 1;
    }
  }

  let finalPermitNumber = '';

  if (isSupp) {
    const seqStr = String(lastSeq).padStart(4, '0');
    if (parentPermitNum) {
      finalPermitNumber = `${parentPermitNum}-${typeCode}${seqStr}`;
    } else {
      finalPermitNumber = `${typeCode}-${jalaliYear}-${seqStr}`;
    }
  } else {
    const seqStr = String(lastSeq).padStart(6, '0');
    finalPermitNumber = `${typeCode}-${jalaliYear}-${seqStr}`;
  }

  return {
    permitNumber: finalPermitNumber,
    sequenceNumber: lastSeq,
    jalaliYear,
    permitTypeCode: typeCode,
    isSupplementary: isSupp,
    parentPermitNumber: parentPermitNum || undefined,
  };
}
