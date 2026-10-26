import * as XLSX from 'xlsx';
import { Personnel } from '../components/PersonnelManagement';
import { normalizeNationalCode, isValidNationalCodeFormat } from '../utils/personnelHelper';
import { addAuditLog } from '../utils/authHelper';
import { calculateExactAge } from '../utils/jalaliDate';
import { apiDb } from './apiDatabaseClient';
import { workerManager } from '../workers/workerManager';
import {
  normalizePersianArabicText,
  normalizeForMatching,
  cleanPersianValue,
  cleanExcelCellValue,
  normalizeDigits,
  matchPersonnelNames
} from '../utils/textNormalization';

export const GENDER_OPTIONS = ['مرد', 'زن'] as const;
export type GenderType = typeof GENDER_OPTIONS[number];

export const MILITARY_STATUS_OPTIONS = [
  'پایان خدمت',
  'معافیت دائم',
  'معافیت تحصیلی',
  'مشمول',
  'معافیت پزشکی',
  'غیرمشمول (خانم‌ها)'
] as const;
export type MilitaryStatusType = typeof MILITARY_STATUS_OPTIONS[number];

export interface PersonnelImportRowPreview {
  rowId: number;
  rawNationalCode: string;
  rawPersonnelCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  militaryStatus: string;
  workplace?: string;
  unit: string;
  subUnit: string;
  jobTitle: string;
  birthDate: string;
  phone: string;
  education: string;
  maritalStatus: string;
  childrenCount: string;
  notes: string;

  // Matching & Status
  action: 'CREATE' | 'UPDATE' | 'DUPLICATE_WARNING' | 'ERROR';
  matchMethod?: 'NATIONAL_CODE' | 'PERSONNEL_CODE' | 'NAME_MATCH' | 'NONE';
  matchedPersonnelId?: string;
  matchedPersonnelCode?: string;
  matchedFullName?: string;

  changedFields: { fieldName: string; labelFa: string; oldValue: string; newValue: string }[];
  errors: string[];
  warnings: string[];
}

export interface PersonnelImportPreviewResult {
  fileName: string;
  fileSize: number;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  warningCount: number;
  errorCount: number;
  rows: PersonnelImportRowPreview[];
}

/**
 * Normalizes gender input string from Excel (e.g., "آقا", "مرد", "زن", "خانم", "M", "F")
 */
export function normalizeGender(rawVal?: string): string {
  if (!rawVal) return 'مرد';
  const clean = normalizeForMatching(rawVal);
  if (clean.includes('زن') || clean.includes('خانم') || clean === 'f' || clean === 'female') {
    return 'زن';
  }
  return 'مرد';
}

/**
 * Normalizes military status input string from Excel
 */
export function normalizeMilitaryStatus(rawVal?: string, gender?: string): string {
  if (gender === 'زن') return 'غیرمشمول (خانم‌ها)';
  if (!rawVal) return 'پایان خدمت';

  const clean = normalizeForMatching(rawVal);
  if (clean.includes('پایان') || clean.includes('کارت') || clean.includes('انجام')) return 'پایان خدمت';
  if (clean.includes('دائم') || clean.includes('دایمی')) return 'معافیت دائم';
  if (clean.includes('تحصیل') || clean.includes('دانشج')) return 'معافیت تحصیلی';
  if (clean.includes('مشمول')) return 'مشمول';
  if (clean.includes('پزشک')) return 'معافیت پزشکی';
  if (clean.includes('غیرمشمول') || clean.includes('خانم')) return 'غیرمشمول (خانم‌ها)';

  return cleanPersianValue(rawVal) || 'پایان خدمت';
}

/**
 * Auto-detects Excel column mappings for Personnel Master Data fields font-independently
 */
function autoDetectPersonnelColumnMappings(headers: string[]) {
  const mappings: { [key: string]: string } = {};

  headers.forEach(h => {
    const clean = normalizeForMatching(h).replace(/[\s_\-]/g, '');

    if (!mappings.nationalCode && (clean.includes('کدملی') || clean.includes('شناسهملی') || clean.includes('شمارهملی') || clean.includes('nationalcode') || clean === 'national_code' || clean === 'nid')) {
      mappings.nationalCode = h;
    } else if (!mappings.personnelCode && (clean.includes('کدپرسنلی') || clean.includes('شمارهپرسنلی') || clean.includes('کدپرسنل') || clean.includes('شمارهکارمندی') || clean.includes('کدکارمندی') || clean.includes('personnelcode') || clean === 'empcode' || clean === 'personnel_code' || clean === 'pcode')) {
      mappings.personnelCode = h;
    } else if (!mappings.firstName && (clean === 'نام' || clean === 'نامکوچک' || clean === 'اسم' || clean.includes('firstname') || clean === 'first_name')) {
      mappings.firstName = h;
    } else if (!mappings.lastName && (clean.includes('خانوادگی') || clean.includes('فامیلی') || clean.includes('شهرت') || clean.includes('lastname') || clean === 'last_name')) {
      mappings.lastName = h;
    } else if (!mappings.fullName && (clean.includes('ناموخانوادگی') || clean.includes('fullname') || clean.includes('full_name') || clean.includes('نامکامل') || clean === 'ناموشهرت')) {
      mappings.fullName = h;
    } else if (!mappings.gender && (clean.includes('جنسیت') || clean.includes('جنس') || clean === 'gender' || clean === 'sex')) {
      mappings.gender = h;
    } else if (!mappings.militaryStatus && (clean.includes('نظاموظیفه') || clean.includes('خدمت') || clean.includes('militarystatus') || clean.includes('military'))) {
      mappings.militaryStatus = h;
    } else if (!mappings.workplace && (clean.includes('محلخدمت') || clean.includes('سایت') || clean.includes('پتروشیمی') || clean.includes('محلکار') || clean.includes('workplace') || clean.includes('location') || clean.includes('site'))) {
      mappings.workplace = h;
    } else if (!mappings.unit && (clean.includes('واحد') || clean.includes('دپارتمان') || clean.includes('مدیریت') || clean.includes('اداره') || clean.includes('بخش') || clean === 'unit' || clean === 'department')) {
      mappings.unit = h;
    } else if (!mappings.subUnit && (clean.includes('زیرواحد') || clean.includes('قسمت') || clean.includes('کارگاه') || clean === 'subunit' || clean === 'sub_unit')) {
      mappings.subUnit = h;
    } else if (!mappings.jobTitle && (clean.includes('عنوانشغلی') || clean.includes('سمت') || clean.includes('پست') || clean.includes('شغل') || clean === 'jobtitle' || clean === 'position')) {
      mappings.jobTitle = h;
    } else if (!mappings.birthDate && (clean.includes('تولد') || clean.includes('birthdate') || clean === 'birth_date')) {
      mappings.birthDate = h;
    } else if (!mappings.phone && (clean.includes('تلفن') || clean.includes('موبایل') || clean.includes('تماس') || clean.includes('همراه') || clean === 'phone' || clean === 'mobile')) {
      mappings.phone = h;
    } else if (!mappings.education && (clean.includes('تحصیلات') || clean.includes('مدرک') || clean === 'education')) {
      mappings.education = h;
    } else if (!mappings.maritalStatus && (clean.includes('تاهل') || clean.includes('تأهل') || clean === 'maritalstatus' || clean === 'marital')) {
      mappings.maritalStatus = h;
    } else if (!mappings.childrenCount && (clean.includes('فرزند') || clean.includes('اولاد') || clean === 'childrencount' || clean === 'children')) {
      mappings.childrenCount = h;
    } else if (!mappings.notes && (clean.includes('توضیح') || clean.includes('ملاحظات') || clean.includes('شرح') || clean === 'notes' || clean === 'description')) {
      mappings.notes = h;
    }
  });

  return mappings;
}

/**
 * Safely extracts raw cell value as-is without any normalization or alteration.
 */
function extractRawCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return String(val);
    return String(val);
  }
  return String(val);
}

/**
 * Parses Personnel Excel file and generates pre-commit comparison preview
 */
export async function parsePersonnelExcelFile(
  file: File,
  existingPersonnelList: Personnel[],
  onProgress?: (progress: number, message?: string) => void
): Promise<PersonnelImportPreviewResult> {
  const data = await file.arrayBuffer();

  // 1. Attempt high-performance non-blocking Web Worker execution
  try {
    const workerResult = await workerManager.executeTask<any, any>(
      'EXCEL_PARSE_PERSONNEL',
      { fileBuffer: data, existingPersonnelList },
      onProgress
    ).promise;

    if (workerResult && Array.isArray(workerResult.rows)) {
      return {
        fileName: file.name,
        fileSize: file.size,
        totalRows: workerResult.totalRows,
        createdCount: workerResult.createdCount,
        updatedCount: workerResult.updatedCount,
        warningCount: workerResult.warningCount,
        errorCount: workerResult.errorCount,
        rows: workerResult.rows
      };
    }
  } catch (workerErr) {
    console.warn('HSECORE: Web Worker parsing fell back to main thread:', workerErr);
  }

  // 2. Synchronous fallback
  const workbook = XLSX.read(data, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('فایل اکسل انتخاب‌شده دارای هیچ شیت اطلاعاتی نمی‌باشد.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawJson || rawJson.length === 0) {
    throw new Error('فایل اکسل خالی است یا اطلاعات خوانا در آن یافت نشد.');
  }

  const headers = Object.keys(rawJson[0]);
  const mappings = autoDetectPersonnelColumnMappings(headers);

  const rowsPreview: PersonnelImportRowPreview[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  const seenNationalCodesInFile = new Set<string>();
  const seenPersonnelCodesInFile = new Set<string>();

  rawJson.forEach((row, idx) => {
    const rowId = idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract exact raw cell strings as they exist in Excel
    const rawNationalCode = extractRawCellValue(row[mappings.nationalCode || '']);
    const rawPersonnelCode = extractRawCellValue(row[mappings.personnelCode || '']);
    let rawFirstName = extractRawCellValue(row[mappings.firstName || '']);
    let rawLastName = extractRawCellValue(row[mappings.lastName || '']);
    const rawFullNameStr = extractRawCellValue(row[mappings.fullName || '']);

    if ((!rawFirstName || !rawLastName) && rawFullNameStr) {
      const parts = rawFullNameStr.trim().split(/\s+/);
      rawFirstName = rawFirstName || parts[0] || '';
      rawLastName = rawLastName || parts.slice(1).join(' ') || '';
    }

    const fullName = (rawFirstName && rawLastName ? `${rawFirstName} ${rawLastName}` : (rawFullNameStr || rawFirstName || rawLastName || '—'));
    const gender = extractRawCellValue(row[mappings.gender || '']);
    const militaryStatus = extractRawCellValue(row[mappings.militaryStatus || '']);
    const workplace = extractRawCellValue(row[mappings.workplace || '']);
    const unit = extractRawCellValue(row[mappings.unit || '']);
    const subUnit = extractRawCellValue(row[mappings.subUnit || '']);
    const jobTitle = extractRawCellValue(row[mappings.jobTitle || '']);
    const birthDate = extractRawCellValue(row[mappings.birthDate || '']);
    const phone = extractRawCellValue(row[mappings.phone || '']);
    const education = extractRawCellValue(row[mappings.education || '']);
    const maritalStatus = extractRawCellValue(row[mappings.maritalStatus || '']);
    const childrenCount = extractRawCellValue(row[mappings.childrenCount || '']);
    const notes = extractRawCellValue(row[mappings.notes || '']);

    // Temporary normalized variables for matching & validation only
    const normNatCode = normalizeNationalCode(rawNationalCode);
    const normPersCode = normalizeDigits(rawPersonnelCode).trim();

    // Validation checks
    if (!rawNationalCode && !rawPersonnelCode && !rawFullNameStr && !rawLastName) {
      errors.push('اطلاعات هویتی (کد ملی، کد پرسنلی یا نام پرسنل) خالی است.');
    }
    if (normNatCode && !isValidNationalCodeFormat(normNatCode)) {
      warnings.push('فرمت کد ملی غیراستاندارد می‌باشد.');
    }

    // Duplicate in file check
    if (normNatCode && seenNationalCodesInFile.has(normNatCode)) {
      warnings.push('کد ملی تکراری در همین فایل اکسل وجود دارد.');
    } else if (normNatCode) {
      seenNationalCodesInFile.add(normNatCode);
    }

    if (normPersCode && seenPersonnelCodesInFile.has(normPersCode)) {
      warnings.push('کد پرسنلی تکراری در همین فایل اکسل وجود دارد.');
    } else if (normPersCode) {
      seenPersonnelCodesInFile.add(normPersCode);
    }

    // Match logic: 1. National Code, 2. Personnel Code, 3. Normalized Name Match
    let matchedPerson: Personnel | undefined = undefined;
    let matchMethod: 'NATIONAL_CODE' | 'PERSONNEL_CODE' | 'NAME_MATCH' | 'NONE' = 'NONE';

    if (normNatCode) {
      matchedPerson = existingPersonnelList.find(p => normalizeNationalCode(p.nationalCode) === normNatCode);
      if (matchedPerson) matchMethod = 'NATIONAL_CODE';
    }

    if (!matchedPerson && normPersCode) {
      matchedPerson = existingPersonnelList.find(p => {
        if (!p.personnelCode) return false;
        return normalizeDigits(p.personnelCode).trim() === normPersCode ||
               normalizeForMatching(p.personnelCode) === normalizeForMatching(rawPersonnelCode);
      });
      if (matchedPerson) matchMethod = 'PERSONNEL_CODE';
    }

    if (!matchedPerson && rawFirstName && rawLastName) {
      matchedPerson = existingPersonnelList.find(p => {
        return matchPersonnelNames(rawFirstName, rawLastName, p.firstName, p.lastName) ||
               matchPersonnelNames(rawFirstName, rawLastName, `${p.firstName || ''} ${p.lastName || ''}`);
      });
      if (matchedPerson) matchMethod = 'NAME_MATCH';
    }

    let action: 'CREATE' | 'UPDATE' | 'DUPLICATE_WARNING' | 'ERROR' = 'CREATE';
    const changedFields: { fieldName: string; labelFa: string; oldValue: string; newValue: string }[] = [];

    if (errors.length > 0) {
      action = 'ERROR';
      errorCount++;
    } else if (matchedPerson) {
      action = 'UPDATE';
      updatedCount++;

      // Compare and fill missing / update fields based on normalized difference
      const addChangeIfDiff = (key: keyof Personnel, labelFa: string, newFieldValue: string) => {
        if (!newFieldValue) return; // Do not erase non-empty existing data
        const currentVal = String(matchedPerson![key] || '');
        if (normalizeForMatching(currentVal) !== normalizeForMatching(newFieldValue)) {
          changedFields.push({
            fieldName: String(key),
            labelFa,
            oldValue: currentVal || '— (خالی)',
            newValue: newFieldValue
          });
        }
      };

      addChangeIfDiff('firstName', 'نام', rawFirstName);
      addChangeIfDiff('lastName', 'نام خانوادگی', rawLastName);
      addChangeIfDiff('workplace', 'محل خدمت', workplace);
      addChangeIfDiff('unit', 'واحد', unit);
      addChangeIfDiff('subUnit', 'زیرواحد', subUnit);
      addChangeIfDiff('jobTitle', 'عنوان شغلی', jobTitle);
      addChangeIfDiff('phone', 'شماره تماس', phone);
      addChangeIfDiff('birthDate', 'تاریخ تولد', birthDate);
      addChangeIfDiff('education', 'تحصیلات', education);
      addChangeIfDiff('maritalStatus', 'وضعیت تأهل', maritalStatus);
      addChangeIfDiff('childrenCount', 'تعداد فرزندان', childrenCount);
      addChangeIfDiff('gender', 'جنسیت', gender);
      addChangeIfDiff('militaryStatus', 'وضعیت نظام وظیفه', militaryStatus);
      if (notes) addChangeIfDiff('notes', 'توضیحات', notes);

    } else {
      action = warnings.length > 0 ? 'DUPLICATE_WARNING' : 'CREATE';
      if (action === 'DUPLICATE_WARNING') warningCount++;
      else createdCount++;
    }

    rowsPreview.push({
      rowId,
      rawNationalCode,
      rawPersonnelCode,
      firstName: rawFirstName,
      lastName: rawLastName,
      fullName,
      gender,
      militaryStatus,
      workplace,
      unit,
      subUnit,
      jobTitle,
      birthDate,
      phone,
      education,
      maritalStatus,
      childrenCount,
      notes,

      action,
      matchMethod,
      matchedPersonnelId: matchedPerson?.id,
      matchedPersonnelCode: matchedPerson?.personnelCode,
      matchedFullName: matchedPerson ? `${matchedPerson.firstName} ${matchedPerson.lastName}` : undefined,

      changedFields,
      errors,
      warnings
    });
  });

  return {
    fileName: file.name,
    fileSize: file.size,
    totalRows: rawJson.length,
    createdCount,
    updatedCount,
    warningCount,
    errorCount,
    rows: rowsPreview
  };
}

/**
 * Commits approved Excel import rows to System Personnel Master Database
 */
export async function commitPersonnelImportBatch(
  rows: PersonnelImportRowPreview[],
  existingList: Personnel[],
  currentUser: any
): Promise<{ updatedList: Personnel[]; createdCount: number; updatedCount: number; errorCount: number }> {
  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  let currentPersonnelList = [...existingList];

  rows.forEach((row, idx) => {
    if (row.action === 'ERROR') {
      errorCount++;
      return;
    }

    if (row.action === 'UPDATE' && row.matchedPersonnelId) {
      // Update existing record
      currentPersonnelList = currentPersonnelList.map(p => {
        if (p.id !== row.matchedPersonnelId) return p;

        return {
          ...p,
          firstName: row.firstName || p.firstName,
          lastName: row.lastName || p.lastName,
          workplace: row.workplace || p.workplace || '',
          unit: row.unit || p.unit,
          subUnit: row.subUnit || p.subUnit,
          jobTitle: row.jobTitle || p.jobTitle,
          phone: row.phone || p.phone,
          birthDate: row.birthDate || p.birthDate,
          education: row.education || p.education,
          maritalStatus: row.maritalStatus || p.maritalStatus,
          childrenCount: row.childrenCount !== undefined && row.childrenCount !== '' ? row.childrenCount : p.childrenCount,
          gender: row.gender !== undefined && row.gender !== '' ? row.gender : p.gender,
          militaryStatus: row.militaryStatus !== undefined && row.militaryStatus !== '' ? row.militaryStatus : p.militaryStatus,
          notes: row.notes ? (p.notes ? `${p.notes} | ${row.notes}` : row.notes) : p.notes
        };
      });
      updatedCount++;
    } else {
      // Ensure we do not add duplicate in currentPersonnelList if already exists
      const alreadyAddedIdx = currentPersonnelList.findIndex(p => 
        (row.rawNationalCode && p.nationalCode && normalizeDigits(p.nationalCode, true) === normalizeDigits(row.rawNationalCode, true)) ||
        (row.rawPersonnelCode && p.personnelCode && normalizeDigits(p.personnelCode).trim() === normalizeDigits(row.rawPersonnelCode).trim())
      );

      if (alreadyAddedIdx >= 0) {
        // Update existing instead of creating duplicate
        const p = currentPersonnelList[alreadyAddedIdx];
        currentPersonnelList[alreadyAddedIdx] = {
          ...p,
          firstName: row.firstName || p.firstName,
          lastName: row.lastName || p.lastName,
          workplace: row.workplace || p.workplace,
          unit: row.unit || p.unit,
          subUnit: row.subUnit || p.subUnit,
          jobTitle: row.jobTitle || p.jobTitle,
          phone: row.phone || p.phone,
          birthDate: row.birthDate || p.birthDate,
          education: row.education || p.education,
          maritalStatus: row.maritalStatus || p.maritalStatus,
          childrenCount: row.childrenCount !== undefined && row.childrenCount !== '' ? row.childrenCount : p.childrenCount,
          gender: row.gender !== undefined && row.gender !== '' ? row.gender : p.gender,
          militaryStatus: row.militaryStatus !== undefined && row.militaryStatus !== '' ? row.militaryStatus : p.militaryStatus,
          notes: row.notes ? (p.notes ? `${p.notes} | ${row.notes}` : row.notes) : p.notes
        };
        updatedCount++;
        return;
      }

      // Create new record with guaranteed unique ID and code
      const uniqueSuffix = `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const newPersonnel: Personnel = {
        id: `emp-${uniqueSuffix}`,
        firstName: row.firstName || row.fullName.split(' ')[0] || 'پرسنل',
        lastName: row.lastName || row.fullName.split(' ').slice(1).join(' ') || 'جدید',
        personnelCode: row.rawPersonnelCode || `EMP-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
        nationalCode: row.rawNationalCode,
        workplace: row.workplace || '',
        unit: row.unit || 'نامشخص',
        subUnit: row.subUnit || '',
        jobTitle: row.jobTitle || '',
        birthDate: row.birthDate || '',
        age: row.birthDate ? calculateExactAge(row.birthDate) : 30,
        phone: row.phone || '',
        education: row.education || 'دیپلم',
        childrenCount: row.childrenCount || '0',
        maritalStatus: row.maritalStatus || 'مجرد',
        gender: row.gender || 'مرد',
        militaryStatus: row.militaryStatus || 'پایان خدمت',
        notes: row.notes || 'ثبت شده از طریق ورود فایل اکسل'
      };
      currentPersonnelList.unshift(newPersonnel);
      createdCount++;
    }
  });

  // Persist directly to database (Single Source of Truth)
  try {
    await apiDb.batchSavePersonnel(currentPersonnelList);
    apiDb.invalidateCache('personnel', 'users', 'sync:full');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('app_data_mutated'));
      window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: currentPersonnelList }));
    }
  } catch (e) {
    console.error('Error saving updated personnel list to database:', e);
  }

  // Record System Audit Log
  const creator = currentUser?.fullName || currentUser?.username || 'مدیر اصلی سیستم';
  addAuditLog(
    creator,
    `ورود گروهی اطلاعات پرسنل از اکسل (${createdCount} ایجاد جدید، ${updatedCount} بروزرسانی)`,
    'موفقیت‌آمیز'
  );

  return {
    updatedList: currentPersonnelList,
    createdCount,
    updatedCount,
    errorCount
  };
}

/**
 * Generates and downloads a standardized Persian Excel Template (.xlsx)
 * for importing personnel master data.
 */
export function downloadPersonnelExcelTemplate(): void {
  // Fictional, standardized sample rows for demonstration and guidance
  const sampleData = [
    {
      'نام': 'علی',
      'نام خانوادگی': 'رضایی',
      'کد پرسنلی': '1001',
      'کد ملی': '0012345678',
      'محل خدمت': 'سایت اصلی پتروشیمی',
      'واحد': 'بهداشت، ایمنی و محیط زیست (HSE)',
      'زیرواحد': 'ایمنی فرآیند',
      'عنوان شغلی': 'کارشناس ارشد ایمنی',
      'تاریخ تولد': '1370/01/15',
      'شماره تماس': '09120000001',
      'تحصیلات': 'کارشناسی ارشد',
      'وضعیت تاهل': 'متاهل',
      'تعداد فرزندان': '1',
      'جنسیت': 'مرد',
      'نظام وظیفه': 'پایان خدمت',
      'ملاحظات': 'پرسنل رسمی - نمونه جهت راهنمای ورود داده'
    },
    {
      'نام': 'فاطمه',
      'نام خانوادگی': 'محمدی',
      'کد پرسنلی': '1002',
      'کد ملی': '0023456789',
      'محل خدمت': 'ساختمان اداری ستاد',
      'واحد': 'منابع انسانی',
      'زیرواحد': 'آموزش و توسعه',
      'عنوان شغلی': 'کارشناس آموزش HSE',
      'تاریخ تولد': '1374/06/20',
      'شماره تماس': '09120000002',
      'تحصیلات': 'کارشناسی',
      'وضعیت تاهل': 'مجرد',
      'تعداد فرزندان': '0',
      'جنسیت': 'زن',
      'نظام وظیفه': 'غیرمشمول (خانم‌ها)',
      'ملاحظات': 'پرسنل قراردادی - نمونه جهت راهنمای ورود داده'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  // Column widths for optimal readability
  ws['!cols'] = [
    { wch: 15 }, // نام
    { wch: 18 }, // نام خانوادگی
    { wch: 14 }, // کد پرسنلی
    { wch: 16 }, // کد ملی
    { wch: 22 }, // محل خدمت
    { wch: 32 }, // واحد
    { wch: 20 }, // زیرواحد
    { wch: 24 }, // عنوان شغلی
    { wch: 14 }, // تاریخ تولد
    { wch: 16 }, // شماره تماس
    { wch: 16 }, // تحصیلات
    { wch: 14 }, // وضعیت تاهل
    { wch: 14 }, // تعداد فرزندان
    { wch: 12 }, // جنسیت
    { wch: 20 }, // نظام وظیفه
    { wch: 35 }  // ملاحظات
  ];

  // Additional Guidance Sheet
  const guideRows = [
    ['ستون', 'شرح و راهنمای تکمیل', 'نوع فیلد', 'الزامی / اختیاری', 'نمونه مقدار معتبر'],
    ['نام', 'نام کوچک پرسنل', 'متنی', 'الزامی', 'علی'],
    ['نام خانوادگی', 'نام خانوادگی کامل پرسنل', 'متنی', 'الزامی', 'رضایی'],
    ['کد پرسنلی', 'کد پرسنلی منحصربه‌فرد در سازمان', 'متنی یا عددی', 'الزامی (در صورت نبود کد ملی)', '1001'],
    ['کد ملی', 'کد ملی ۱۰ رقمی معتبر (بدون خط تیره یا فاصله)', 'عددی', 'الزامی (در صورت نبود کد پرسنلی)', '0012345678'],
    ['محل خدمت', 'سایت، کارخانه، ساختمان یا دفتر محل فعالیت', 'متنی', 'اختیاری', 'سایت اصلی پتروشیمی'],
    ['واحد', 'نام واحد، مدیریت یا دپارتمان سازمانی', 'متنی', 'اختیاری', 'بهداشت، ایمنی و محیط زیست (HSE)'],
    ['زیرواحد', 'نام زیرواحد یا قسمت تابعه', 'متنی', 'اختیاری', 'ایمنی فرآیند'],
    ['عنوان شغلی', 'سمت یا پست سازمانی', 'متنی', 'اختیاری', 'کارشناس ارشد ایمنی'],
    ['تاریخ تولد', 'تاریخ تولد به فرمت هجری شمسی (YYYY/MM/DD)', 'متنی', 'اختیاری', '1370/01/15'],
    ['شماره تماس', 'شماره همراه در دسترس (۱۱ رقم با پیش‌شماره ۰۹)', 'متنی', 'اختیاری', '09120000001'],
    ['تحصیلات', 'مقطع تحصیلی (دیپلم، کاردانی، کارشناسی، کارشناسی ارشد، دکتری)', 'متنی', 'اختیاری', 'کارشناسی ارشد'],
    ['وضعیت تاهل', 'مجرد یا متاهل', 'متنی', 'اختیاری', 'متاهل'],
    ['تعداد فرزندان', 'تعداد فرزندان تحت تکفل (عدد)', 'عددی', 'اختیاری', '1'],
    ['جنسیت', 'مرد یا زن', 'انتخابی (مرد / زن)', 'اختیاری', 'مرد'],
    ['نظام وظیفه', 'پایان خدمت، معافیت دائم، معافیت تحصیلی، مشمول، معافیت پزشکی، غیرمشمول (خانم‌ها)', 'متنی', 'اختیاری', 'پایان خدمت'],
    ['ملاحظات', 'توضیحات تکمیلی یا وضعیت استخدامی', 'متنی', 'اختیاری', 'پرسنل رسمی']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 18 }, { wch: 50 }, { wch: 18 }, { wch: 22 }, { wch: 25 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'اطلاعات پرسنل');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'راهنمای ورود اطلاعات');

  XLSX.writeFile(wb, 'قالب_نمونه_ورود_اطلاعات_پرسنل_HSECORE.xlsx');
}

