/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import { WorkerTaskRequest, WorkerTaskResponse } from './types';

/* eslint-disable no-restricted-globals */
const ctx: DedicatedWorkerGlobalScope = self as any;

function normalizeDigits(str: any, englishOnly = false): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  const faToEn: Record<string, string> = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return s.replace(/[۰-۹٠-٩]/g, d => faToEn[d] || d).trim();
}

function normalizeNationalCode(code?: string): string {
  if (!code) return '';
  const digits = normalizeDigits(code).replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(10, '0');
}

function normalizeForMatching(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[\u200C\u200B\u200E\u200F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractRawCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function autoDetectPersonnelColumnMappings(headers: string[]) {
  const map: Record<string, string> = {};

  const cleanHeader = (h: string) => normalizeForMatching(h);

  headers.forEach(h => {
    const norm = cleanHeader(h);
    if (!map.nationalCode && (norm.includes('کد ملی') || norm.includes('کدملی') || norm.includes('شناسه ملی') || norm.includes('national code') || norm.includes('nid'))) {
      map.nationalCode = h;
    } else if (!map.personnelCode && (norm.includes('پرسنلی') || norm.includes('استخدامی') || norm.includes('کارمندی') || norm.includes('personnel code') || norm.includes('emp code'))) {
      map.personnelCode = h;
    } else if (!map.fullName && (norm.includes('نام و نام') || norm.includes('نام کامل') || norm.includes('full name'))) {
      map.fullName = h;
    } else if (!map.firstName && (norm === 'نام' || norm === 'first name' || norm === 'fname')) {
      map.firstName = h;
    } else if (!map.lastName && (norm.includes('خانوادگی') || norm.includes('فامیلی') || norm.includes('شهرت') || norm === 'last name' || norm === 'lname')) {
      map.lastName = h;
    } else if (!map.gender && (norm.includes('جنسیت') || norm.includes('gender') || norm === 'sex')) {
      map.gender = h;
    } else if (!map.unit && (norm.includes('واحد') || norm.includes('دپارتمان') || norm.includes('بخش') || norm.includes('unit') || norm.includes('dept'))) {
      map.unit = h;
    } else if (!map.subUnit && (norm.includes('زیرمجموعه') || norm.includes('قسمت') || norm.includes('کارگاه') || norm.includes('sub unit'))) {
      map.subUnit = h;
    } else if (!map.jobTitle && (norm.includes('شغل') || norm.includes('سمت') || norm.includes('پست') || norm.includes('job') || norm.includes('position'))) {
      map.jobTitle = h;
    } else if (!map.phone && (norm.includes('تلفن') || norm.includes('موبایل') || norm.includes('تماس') || norm.includes('همراه') || norm.includes('phone') || norm.includes('mobile'))) {
      map.phone = h;
    } else if (!map.birthDate && (norm.includes('تولد') || norm.includes('birth'))) {
      map.birthDate = h;
    } else if (!map.workplace && (norm.includes('محل خدمت') || norm.includes('محل کار') || norm.includes('سایت') || norm.includes('کارخانه') || norm.includes('workplace') || norm.includes('site'))) {
      map.workplace = h;
    } else if (!map.education && (norm.includes('تحصیل') || norm.includes('مدرک') || norm.includes('education') || norm.includes('degree'))) {
      map.education = h;
    } else if (!map.maritalStatus && (norm.includes('تاهل') || norm.includes('تأهل') || norm.includes('marital'))) {
      map.maritalStatus = h;
    }
  });

  return map;
}

ctx.onmessage = (event: MessageEvent<WorkerTaskRequest>) => {
  const { taskId, type, payload } = event.data;
  const startTime = performance.now();

  const reportProgress = (progress: number, statusMessage?: string) => {
    ctx.postMessage({
      taskId,
      type: 'PROGRESS',
      progress,
      statusMessage
    });
  };

  try {
    let result: any = null;

    if (type === 'EXCEL_PARSE_PERSONNEL') {
      const { fileBuffer, existingPersonnelList = [] } = payload;
      reportProgress(10, 'در حال خواندن ساختار فایل اکسل...');

      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('فایل اکسل بدون برگه (Sheet) می‌باشد.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawJson || rawJson.length === 0) {
        throw new Error('فایل اکسل خالی است یا سطری در آن یافت نشد.');
      }

      reportProgress(30, 'تشخیص ستون‌ها و تطبیق فیلدها...');

      const headers = Object.keys(rawJson[0]);
      const mappings = autoDetectPersonnelColumnMappings(headers);

      const rowsPreview: any[] = [];
      let createdCount = 0;
      let updatedCount = 0;
      let warningCount = 0;
      let errorCount = 0;

      const seenNationalCodesInFile = new Set<string>();
      const seenPersonnelCodesInFile = new Set<string>();

      const totalRows = rawJson.length;

      for (let idx = 0; idx < totalRows; idx++) {
        const row = rawJson[idx];
        const rowId = idx + 1;
        const errors: string[] = [];
        const warnings: string[] = [];

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
        const gender = extractRawCellValue(row[mappings.gender || '']) || 'مرد';
        const militaryStatus = extractRawCellValue(row[mappings.militaryStatus || '']) || 'پایان خدمت';
        const workplace = extractRawCellValue(row[mappings.workplace || '']);
        const unit = extractRawCellValue(row[mappings.unit || '']);
        const subUnit = extractRawCellValue(row[mappings.subUnit || '']);
        const jobTitle = extractRawCellValue(row[mappings.jobTitle || '']);
        const birthDate = extractRawCellValue(row[mappings.birthDate || '']);
        const phone = extractRawCellValue(row[mappings.phone || '']);
        const education = extractRawCellValue(row[mappings.education || '']);
        const maritalStatus = extractRawCellValue(row[mappings.maritalStatus || '']);
        const childrenCount = extractRawCellValue(row[mappings.childrenCount || '']) || '0';
        const notes = extractRawCellValue(row[mappings.notes || '']);

        const normNatCode = normalizeNationalCode(rawNationalCode);
        const normPersCode = normalizeDigits(rawPersonnelCode).trim();

        if (!rawNationalCode && !rawPersonnelCode && !rawFullNameStr && !rawLastName) {
          errors.push('اطلاعات هویتی (کد ملی، کد پرسنلی یا نام پرسنل) خالی است.');
        }

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

        // Matching logic
        let matchedPerson: any = undefined;
        let matchMethod: 'NATIONAL_CODE' | 'PERSONNEL_CODE' | 'NAME_MATCH' | 'NONE' = 'NONE';

        if (normNatCode) {
          matchedPerson = existingPersonnelList.find((p: any) => normalizeNationalCode(p.nationalCode) === normNatCode);
          if (matchedPerson) matchMethod = 'NATIONAL_CODE';
        }

        if (!matchedPerson && normPersCode) {
          matchedPerson = existingPersonnelList.find((p: any) => normalizeDigits(p.personnelCode).trim() === normPersCode);
          if (matchedPerson) matchMethod = 'PERSONNEL_CODE';
        }

        if (!matchedPerson && rawFirstName && rawLastName) {
          const normInputFname = normalizeForMatching(rawFirstName);
          const normInputLname = normalizeForMatching(rawLastName);
          matchedPerson = existingPersonnelList.find((p: any) => {
            const pFname = normalizeForMatching(p.firstName);
            const pLname = normalizeForMatching(p.lastName);
            return pFname === normInputFname && pLname === normInputLname;
          });
          if (matchedPerson) matchMethod = 'NAME_MATCH';
        }

        let action: 'CREATE' | 'UPDATE' | 'DUPLICATE_WARNING' | 'ERROR' = 'CREATE';
        const changedFields: any[] = [];

        if (errors.length > 0) {
          action = 'ERROR';
          errorCount++;
        } else if (matchedPerson) {
          action = 'UPDATE';
          updatedCount++;
          // Check changed fields
          const checkChange = (field: string, labelFa: string, newVal: string, oldVal?: string) => {
            if (newVal && oldVal && newVal.trim() !== oldVal.trim()) {
              changedFields.push({ fieldName: field, labelFa, oldValue: oldVal, newValue: newVal });
            }
          };
          checkChange('unit', 'واحد سازمانی', unit, matchedPerson.unit);
          checkChange('subUnit', 'زیرمجموعه', subUnit, matchedPerson.subUnit);
          checkChange('jobTitle', 'عنوان شغلی', jobTitle, matchedPerson.jobTitle);
          checkChange('workplace', 'محل خدمت', workplace, matchedPerson.workplace);
          checkChange('phone', 'شماره تماس', phone, matchedPerson.phone);
        } else {
          action = 'CREATE';
          createdCount++;
        }

        if (warnings.length > 0) {
          warningCount++;
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

        if (idx % 100 === 0) {
          const pct = Math.min(95, Math.round(30 + (idx / totalRows) * 65));
          reportProgress(pct, `تطبیق ردیف ${idx + 1} از ${totalRows}...`);
        }
      }

      reportProgress(100, 'تحلیل فایل اکسل به پایان رسید.');

      result = {
        totalRows,
        createdCount,
        updatedCount,
        warningCount,
        errorCount,
        rows: rowsPreview
      };
    } else if (type === 'EXCEL_PARSE_MEDICAL_EXAMS') {
      const { fileBuffer } = payload as { fileBuffer: ArrayBuffer };
      reportProgress(15, 'در حال خواندن فایل اکسل معاینات ادواری...');
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('فایل اکسل انتخاب‌شده دارای هیچ شیتی نمی‌باشد.');
      }
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      reportProgress(50, 'در حال استخراج داده‌های پزشکی و آزمایشگاهی...');
      const jsonRecords: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      reportProgress(100, 'تحلیل پرونده‌های پزشکی به پایان رسید.');
      result = {
        records: jsonRecords,
        totalRows: jsonRecords.length
      };
    } else {
      throw new Error(`عملیات ناشناخته برای ورکر اکسل: ${type}`);
    }

    const successResponse: WorkerTaskResponse = {
      taskId,
      type: 'SUCCESS',
      result,
      executionTimeMs: performance.now() - startTime
    };
    ctx.postMessage(successResponse);
  } catch (err: any) {
    const errorResponse: WorkerTaskResponse = {
      taskId,
      type: 'ERROR',
      error: err?.message || 'خطا در تحلیل و خواندن فایل اکسل در ورکر',
      stack: err?.stack
    };
    ctx.postMessage(errorResponse);
  }
};
