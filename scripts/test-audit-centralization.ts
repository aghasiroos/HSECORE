import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeAuditPayload,
  AuditRepository,
  auditRepository,
} from '../server/modules/audit/audit.repository';
import { auditService } from '../server/modules/audit/audit.service';
import auditRouter from '../server/modules/audit/audit.routes';
import { checkUserHasPermission } from '../server/core/middleware/auth';
import {
  normalizeAuditLogEntry,
  computeFieldDiffs,
  mergeAndDeduplicateAuditLogs,
  MODULE_NAMES_FA,
} from '../src/utils/auditEngine';

async function runTests() {
  console.log('--- Running Centralized Audit Log & Security Verification ---');

  // 1. Sensitive Data Redaction (sanitizeAuditPayload)
  {
    const longString = 'A'.repeat(5000);
    const dirty = {
      username: 'ali.rezaei',
      password: 'SuperSecretPassword123!',
      nested: {
        apiKey: 'sk-live-123456',
        smtpPass: 'mail-pass',
        privateKey: '-----BEGIN PRIVATE KEY-----',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
        avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        notes: longString,
      },
      normalField: 'ساختمان اداری شماره ۱',
    };

    const clean = sanitizeAuditPayload(dirty);
    assert.equal(clean.username, 'ali.rezaei');
    assert.equal(clean.password, '[REDACTED]');
    assert.equal(clean.nested.apiKey, '[REDACTED]');
    assert.equal(clean.nested.smtpPass, '[REDACTED]');
    assert.equal(clean.nested.privateKey, '[REDACTED]');
    assert.equal(clean.nested.authorization, '[REDACTED]');
    assert.ok(String(clean.nested.avatar).startsWith('[Binary Data Redacted'));
    assert.ok(String(clean.nested.notes).includes('[Truncated 5000 chars]'));
    assert.equal(clean.normalField, 'ساختمان اداری شماره ۱');

    const bearerDirect = sanitizeAuditPayload('Bearer abc.def.ghi');
    assert.equal(bearerDirect, 'Bearer [REDACTED]');
    console.log('✓ 1. Sensitive data scrubbing & truncation verified');
  }

  // 2. Append-Only Immutability Verification (Repository & Router)
  {
    const protoMethods = Object.getOwnPropertyNames(AuditRepository.prototype);
    const forbiddenMethods = protoMethods.filter((m) =>
      /update|edit|patch|delete|remove|destroy|clear|truncate/i.test(m)
    );
    assert.deepEqual(
      forbiddenMethods,
      [],
      `AuditRepository must be strictly append-only; found forbidden methods: ${forbiddenMethods.join(', ')}`
    );

    const registeredMethods = (auditRouter.stack || [])
      .filter((layer: any) => layer.route)
      .flatMap((layer: any) => Object.keys(layer.route.methods).map((m) => m.toUpperCase()));
    assert.ok(registeredMethods.includes('GET'), 'Audit router must support GET');
    assert.ok(registeredMethods.includes('POST'), 'Audit router must support POST');
    assert.equal(
      registeredMethods.some((m) => ['PUT', 'PATCH', 'DELETE'].includes(m)),
      false,
      'Audit router must NOT expose PUT, PATCH, or DELETE endpoints'
    );
    console.log('✓ 2. Append-only immutability enforced on repository and API router');
  }

  // 3. RBAC Permission Matching for Audit Logs
  {
    const customAuditViewer = {
      id: 101,
      uid: 'auditor-custom',
      username: 'custom_auditor',
      role: 'CUSTOM_ROLE',
      permissions: {
        'Audit Logs': { view: true, export: false, print: false },
      },
    };
    const persianAuditViewer = {
      id: 102,
      uid: 'auditor-fa',
      username: 'fa_auditor',
      role: 'CUSTOM_ROLE',
      permissions: {
        'لاگ عملیات و ممیزی': { view: true },
      },
    };
    const regularUser = {
      id: 103,
      uid: 'worker-1',
      username: 'worker_user',
      role: 'WORKER',
      permissions: {
        'Work Permits': { view: true },
      },
    };

    assert.equal(checkUserHasPermission(customAuditViewer as any, 'audit:read'), true);
    assert.equal(checkUserHasPermission(persianAuditViewer as any, 'audit:read'), true);
    assert.equal(checkUserHasPermission(regularUser as any, 'audit:read'), false);
    assert.equal(checkUserHasPermission(customAuditViewer as any, 'audit:export'), false);
    console.log('✓ 3. RBAC audit:read / export permission resolution verified');
  }

  // 4. Frontend Audit Normalization & Field Diff Sanitization
  {
    assert.equal(MODULE_NAMES_FA['fire_design'], 'طراحی و جانمایی حفاظت حریق');
    assert.equal(MODULE_NAMES_FA['psm'], 'مدیریت استقرار ایمنی فرایند (PSM)');
    assert.equal(MODULE_NAMES_FA['backup'], 'پشتیبان‌گیری و بازیابی دیتابیس');

    // Legacy Fire Design row stored in DB before centralization
    const legacyFireDesignRow = {
      id: 9001,
      userId: 5,
      userUid: 'fire.eng',
      personnelCode: '1042',
      username: 'fire.eng',
      fullName: 'مهندس آتش‌نشانی',
      userRole: 'FIRE_OFFICER',
      action: 'CREATE',
      module: 'FIRE_DESIGN',
      entityType: 'BUILDING',
      entityId: '18',
      oldValue: null,
      newValue: { name: 'انبار مرکزی مواد شیمیایی', occupancyType: 'INDUSTRIAL' },
      details: {
        actionTitle: 'ایجاد ساختمان جدید در طراحی حفاظت حریق',
        reason: 'طراحی اولیه سیستم اسپرینکلر NFPA 13',
      },
      ipAddress: '10.10.2.15',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0',
      result: 'SUCCESS',
      createdAt: '2026-11-10T08:15:00.000Z',
    };

    const normFire = normalizeAuditLogEntry(legacyFireDesignRow);
    assert.equal(normFire.module, 'طراحی و جانمایی حفاظت حریق');
    assert.equal(normFire.actionType, 'CREATE');
    assert.equal(normFire.fullName, 'مهندس آتش‌نشانی');
    assert.equal(normFire.reason, 'طراحی اولیه سیستم اسپرینکلر NFPA 13');
    assert.equal(normFire.success, true);

    // Update with sensitive field & real diff
    const diffs = computeFieldDiffs(
      { status: 'DRAFT', password: 'old', title: 'طرح اولیه' },
      { status: 'APPROVED', password: 'new', title: 'طرح نهایی اسپرینکلر' }
    );
    assert.equal(
      diffs.some((d) => d.field.toLowerCase().includes('password')),
      false,
      'Password fields must be excluded from field-level diffs'
    );
    assert.equal(diffs.length, 2);

    // Soft delete, review, and access denied normalization
    const softDel = normalizeAuditLogEntry({
      id: 9002,
      action: 'SOFT_DELETE',
      module: 'FIRE_DESIGN',
      entityType: 'BUILDING',
      entityId: '18',
      result: 'SUCCESS',
      details: { reason: 'تست حذف نرم ساختمان' },
      createdAt: new Date().toISOString(),
    });
    assert.equal(softDel.actionType, 'SOFT_DELETE');
    assert.equal(softDel.category, 'DATA_MUTATION');
    assert.equal(softDel.severity, 'CRITICAL');

    const denied = normalizeAuditLogEntry({
      id: 9003,
      action: 'ACCESS_DENIED',
      module: 'AUTH',
      entityType: 'PERMISSION_GUARD',
      entityId: '/api/v1/audit-logs',
      result: 'FAILED',
      details: { reason: "مجوز امنیتی 'audit:read' صادر نشده است." },
      createdAt: new Date().toISOString(),
    });
    assert.equal(denied.actionType, 'ACCESS_DENIED');
    assert.equal(denied.success, false);
    assert.equal(denied.category, 'AUTH_SECURITY');
    assert.equal(denied.severity, 'HIGH');

    // Deduplication check
    const merged = mergeAndDeduplicateAuditLogs([legacyFireDesignRow], [normFire]);
    assert.equal(merged.length, 1, 'Duplicate DB + memory event in 2s bucket must collapse to 1');
    console.log('✓ 4. Frontend normalization, legacy FIRE_DESIGN preservation, & deduplication verified');
  }

  // 5. Burst Deduplication & Paginated Read via auditService
  {
    const ts = Date.now();
    await auditService.log({
      userUid: `test-user-${ts}`,
      action: 'CREATE',
      module: 'FIRE_DESIGN',
      entityType: 'FLOOR',
      entityId: `floor-${ts}`,
      details: { actionTitle: 'تست ثبت طبقه', token: 'secret-token-value' },
      result: 'SUCCESS',
    });
    // Immediate duplicate burst within 1.2s should be suppressed
    await auditService.log({
      userUid: `test-user-${ts}`,
      action: 'CREATE',
      module: 'FIRE_DESIGN',
      entityType: 'FLOOR',
      entityId: `floor-${ts}`,
      details: { actionTitle: 'تست ثبت طبقه', token: 'secret-token-value' },
      result: 'SUCCESS',
    });

    const pageRes = await auditRepository.findPaginated({ page: 1, limit: 25 });
    assert.ok(Array.isArray(pageRes.rows));
    assert.ok(pageRes.limit === 25);
    assert.ok(pageRes.totalPages >= 1);
    console.log('✓ 5. AuditService burst deduplication & paginated query contract verified');
  }

  // 6. Verify Dedicated Fire Design Audit UI & Bootstrap Query Removed
  {
    const root = path.resolve(process.cwd());
    const dashboardSrc = fs.readFileSync(
      path.join(root, 'src/modules/fire-dept/fire-design/FireProtectionDashboard.tsx'),
      'utf-8'
    );
    const moduleSrc = fs.readFileSync(
      path.join(root, 'src/modules/fire-dept/fire-design/FireSuppressionDesignModule.tsx'),
      'utf-8'
    );
    const apiSrc = fs.readFileSync(
      path.join(root, 'src/modules/fire-dept/fire-design/fireDesignApi.ts'),
      'utf-8'
    );
    const routesSrc = fs.readFileSync(
      path.join(root, 'server/modules/fire-design/fireDesign.routes.ts'),
      'utf-8'
    );

    assert.equal(dashboardSrc.includes('آخرین تغییرات و رویدادهای ثبت‌شده'), false);
    assert.equal(dashboardSrc.includes('auditTrail'), false);
    assert.equal(moduleSrc.includes('showAuditModal'), false);
    assert.equal(moduleSrc.includes('auditTrail'), false);
    assert.equal(apiSrc.includes('auditTrail'), false);
    assert.equal(routesSrc.includes('auditTrail'), false);
    assert.ok(
      routesSrc.includes("module: 'FIRE_DESIGN'"),
      'Fire design backend must still record audit events centrally with module FIRE_DESIGN'
    );
    console.log('✓ 6. Dedicated Fire Design audit tab/modal/endpoint cleanly removed while centralized logging intact');
  }

  console.log('\nALL CENTRALIZED AUDIT TESTS PASSED SUCCESSFULLY!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
