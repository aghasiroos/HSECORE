/**
 * PTW Hot Work Holiday Control Regression & Security Test Suite
 * Validates Iran calendar holiday calculation (Asia/Tehran), Senior Duty Officer job role enforcement,
 * confirmation modal requirements, and backend API anti-bypass security.
 */

import { checkIsIranHoliday } from '../server/services/iranCalendarService.ts';
import { isSeniorDutyOfficer, validateHotWorkHolidayIssuance } from '../server/services/ptwHolidayService.ts';

async function runPtwHolidayTests() {
  console.log('=== PTW Hot Work Holiday Control Test Suite ===\n');

  // Test 1: Senior Duty Officer job title keyword matching
  console.log('--- Test 1: Senior Duty Officer Job Role Detection ---');
  const validSeniorTitles = [
    'کشیک ارشد',
    'کشیک ارشد تولید',
    'کشیک ارشد نوبت کاری',
    'سرپرست کشیک ارشد مجتمع',
    'Senior Duty Officer',
    'Senior Shift Supervisor',
  ];

  for (const title of validSeniorTitles) {
    if (!isSeniorDutyOfficer(title)) {
      throw new Error(`Failed to recognize valid Senior Duty job title: ${title}`);
    }
  }

  const invalidTitles = [
    'اپراتور اتاق کنترل',
    'کارشناس ایمنی',
    'سرپرست کارگاه',
    'پیمانکار مکانیک',
    'HSE Officer',
  ];

  for (const title of invalidTitles) {
    if (isSeniorDutyOfficer(title)) {
      throw new Error(`Incorrectly classified non-Senior Duty title as Senior Duty: ${title}`);
    }
  }
  console.log('PASS: Senior Duty Officer job role detection verified.\n');

  // Test 2: Normal Work Day (non-holiday) -> Proceed without new restrictions
  console.log('--- Test 2: Normal Work Day (Non-Holiday) ---');
  // '1405/01/16' (Farvardin 16, 1405 - regular Saturday workday)
  const normalDayResult = await validateHotWorkHolidayIssuance({
    permitType: 'HOT_WORK',
    startDate: '1405/01/16',
    applicantPersonnelCode: 'OPERATOR_1',
  });

  if (!normalDayResult.allowed || normalDayResult.isHoliday) {
    throw new Error('Normal work day was incorrectly flagged as holiday or restricted.');
  }
  console.log('PASS: Normal work day permit issuance proceeds without holiday restriction.\n');

  // Test 3: Holiday + Non-Senior Duty Officer + Hot Work -> Completely Blocked
  console.log('--- Test 3: Holiday + Non-Senior Duty Officer + Hot Work ---');
  // '1405/01/01' (Farvardin 1, Nawruz holiday)
  const blockedResult = await validateHotWorkHolidayIssuance(
    {
      permitType: 'HOT_WORK',
      startDate: '1405/01/01',
      applicantPersonnelCode: 'NON_SENIOR_101',
    },
    {
      uid: 'user-non-senior',
      role: 'User',
      personnelCode: 'NON_SENIOR_101',
      name: 'کارشناس عادی',
    }
  );

  if (blockedResult.allowed) {
    throw new Error('Non-Senior Duty Officer was allowed to issue Hot Work permit on a holiday!');
  }
  if (!blockedResult.errorMessage?.includes('کشیک ارشد')) {
    throw new Error('Incorrect block error message returned for non-Senior Duty officer.');
  }
  console.log('PASS: Non-Senior Duty Officer blocked on holiday with exact error message.\n');

  // Test 4: Holiday + Senior Duty Officer + Hot Work WITHOUT Confirmation -> Requires Confirmation
  console.log('--- Test 4: Holiday + Senior Duty Officer + Hot Work (Unconfirmed) ---');
  const unconfirmedResult = await validateHotWorkHolidayIssuance(
    {
      permitType: 'HOT_WORK',
      startDate: '1405/01/01',
      applicantPersonnelCode: 'SENIOR_DUTY_001',
      formData: {
        signatures4Tier: {
          issuer: {
            personnelCode: 'SENIOR_DUTY_001',
            name: 'کشیک ارشد مجتمع',
          },
        },
      },
    },
    {
      uid: 'user-senior',
      role: 'کشیک ارشد تولید',
      personnelCode: 'SENIOR_DUTY_001',
      name: 'کشیک ارشد مجتمع',
    }
  );

  if (unconfirmedResult.allowed) {
    throw new Error('Senior Duty Officer was allowed to issue Hot Work on holiday without explicit confirmation!');
  }
  if (!unconfirmedResult.requiresConfirmation) {
    throw new Error('Requires confirmation flag was not returned for Senior Duty officer.');
  }
  if (!unconfirmedResult.warningMessage?.includes('صدور پروانه کار گرم در روزهای تعطیل')) {
    throw new Error('Warning message text mismatch.');
  }
  console.log('PASS: Warning confirmation required for Senior Duty Officer on holiday.\n');

  // Test 5: Holiday + Senior Duty Officer + Hot Work WITH Confirmation -> Allowed + Audit Trail
  console.log('--- Test 5: Holiday + Senior Duty Officer + Hot Work (Confirmed) ---');
  const confirmedResult = await validateHotWorkHolidayIssuance(
    {
      permitType: 'HOT_WORK',
      startDate: '1405/01/01',
      holidayWarningConfirmed: true,
      applicantPersonnelCode: 'SENIOR_DUTY_001',
      formData: {
        signatures4Tier: {
          issuer: {
            personnelCode: 'SENIOR_DUTY_001',
            name: 'کشیک ارشد مجتمع',
          },
        },
      },
    },
    {
      uid: 'user-senior',
      role: 'کشیک ارشد تولید',
      personnelCode: 'SENIOR_DUTY_001',
      name: 'کشیک ارشد مجتمع',
    }
  );

  if (!confirmedResult.allowed) {
    throw new Error('Confirmed Hot Work permit by Senior Duty officer was rejected!');
  }
  if (!confirmedResult.holidayAuditTrail?.dateShamsi) {
    throw new Error('Holiday audit trail was not recorded in result.');
  }
  console.log('PASS: Confirmed Hot Work permit by Senior Duty officer allowed with complete audit trail.\n');

  // Test 6: Holiday + Cold Work Permit -> Retain Standard Process
  console.log('--- Test 6: Holiday + Cold Work Permit ---');
  const coldWorkResult = await validateHotWorkHolidayIssuance(
    {
      permitType: 'COLD_WORK',
      startDate: '1405/01/01',
      applicantPersonnelCode: 'OPERATOR_1',
    },
    {
      uid: 'user-operator',
      role: 'کارشناس فرآیند',
      personnelCode: 'OPERATOR_1',
      name: 'کارشناس فرآیند',
    }
  );

  if (!coldWorkResult.allowed) {
    throw new Error('Cold Work permit on holiday was incorrectly blocked by Hot Work rule.');
  }
  console.log('PASS: Cold Work permit on holiday retains standard process without restriction.\n');

  console.log('ALL PTW HOT WORK HOLIDAY CONTROL TESTS PASSED (6/6)!');
  process.exit(0);
}

runPtwHolidayTests().catch(err => {
  console.error('PTW Holiday Control test failed:', err);
  process.exit(1);
});
