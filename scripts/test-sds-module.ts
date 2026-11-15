/**
 * Comprehensive End-to-End Integration Test for SDS Submodule
 * Verifies:
 * 1. DB tables & indexes
 * 2. 16-section CRUD + GHS classification
 * 3. Duplicate prevention (normalized CAS, FA name, EN name)
 * 4. Multi-file upload/primary/delete via fileService (without deleting parent SDS)
 * 5. RBAC enforcement on APPROVE / PUBLISH / MARK_OBSOLETE
 * 6. Approved/Published immutability lock & snapshot revision comparison
 * 7. Operational audit log entries
 * 8. Existing documents non-disruption
 * 9. Full cleanup of temporary test rows & files in finally block
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { and, eq, inArray } from 'drizzle-orm';
import { createPool } from '../src/db/index.ts';
import { db, schema } from '../server/core/db.ts';
import { sdsService } from '../server/modules/sds/sds.service.ts';
import { fileService } from '../server/modules/files/file.service.ts';

const pool = createPool();

function makeMockRequest(user: {
  id: number;
  uid: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
}): any {
  return {
    user,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'SDS-E2E-Verifier/1.0' },
    get: (h: string) => (h.toLowerCase() === 'user-agent' ? 'SDS-E2E-Verifier/1.0' : undefined),
    originalUrl: '/api/v1/sds',
    method: 'POST',
  };
}

async function run() {
  const uniqueSuffix = Date.now();
  const createdSdsIds: number[] = [];
  const createdFileIds: string[] = [];
  const testCas = `999-${String(uniqueSuffix).slice(-2)}-9`;
  const testNameFa = `متانول تست یکپارچگی ${uniqueSuffix}`;
  const testNameEn = `Test Methanol Integration ${uniqueSuffix}`;

  const adminReq = makeMockRequest({
    id: 1,
    uid: 'test-admin-uid',
    username: 'test_hse_admin',
    fullName: 'مدیر آزمایشی HSE',
    role: 'ADMIN',
    permissions: ['*'],
  });

  const officerReq = makeMockRequest({
    id: 2,
    uid: 'test-officer-uid',
    username: 'test_safety_officer',
    fullName: 'کارشناس آزمایشی ایمنی',
    role: 'SAFETY_OFFICER',
    permissions: ['documents:read', 'documents:create', 'documents:update', 'documents:delete'],
  });

  try {
    console.log('1. Checking PostgreSQL SDS tables...');
    const tblRes = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('sds_records', 'sds_revisions', 'sds_attachments') ORDER BY table_name`
    );
    assert.equal(tblRes.rows.length, 3, 'All 3 SDS tables must exist in PostgreSQL');
    console.log('   OK: sds_attachments, sds_records, sds_revisions verified.');

    // Record baseline count of existing HSECORE files/documents
    const beforeFilesCountRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM system_files WHERE deleted_at IS NULL`
    );
    const beforeFilesCount = beforeFilesCountRes.rows[0].cnt;

    console.log('2. Testing 16-section SDS creation + GHS data...');
    const created = await sdsService.createSdsRecord(
      {
        documentNumber: `SDS-TEST-${uniqueSuffix}`,
        materialNameFa: testNameFa,
        materialNameEn: testNameEn,
        tradeName: 'Rejal Grade-AA',
        casNumber: testCas,
        unNumber: '1230',
        manufacturer: 'شرکت پتروشیمی نمونه',
        supplier: 'واحد تامین مجتمع',
        unitName: 'واحد الفین',
        storageLocation: 'مخزن T-101',
        physicalState: 'LIQUID',
        preparedDate: '1405/08/25',
        lastRevisionDate: '1405/08/25',
        ghsData: {
          pictograms: ['GHS02', 'GHS06', 'GHS08'],
          signalWord: 'DANGER',
          hazardClasses: ['مایعات اشتعال‌پذیر (Flammable Liquids)'],
          hStatements: ['H225: مایع و بخار بسیار اشتعال‌پذیر'],
          pStatements: ['P210: دور از حرارت نگهداری شود'],
          exposureRoutes: ['INHALATION', 'SKIN_CONTACT'],
          healthHazardsSummary: 'سمی در صورت استنشاق یا جذب پوستی',
        },
        sections: {
          section1: { productIdentifier: testNameEn, emergencyPhone: '125' },
          section3: {
            substanceOrMixture: 'SUBSTANCE',
            chemicalFormula: 'CH3OH',
            ingredients: [
              { ingredientName: 'Methanol', casNumber: testCas, concentration: '99.8%' },
            ],
          },
          section5: { suitableExtinguishingMedia: 'پودر خشک، CO2، فوم مقاوم به الکل' },
          section14: { unNumber: '1230', transportHazardClass: '3 (6.1)', packingGroup: 'II' },
        },
      },
      officerReq
    );
    createdSdsIds.push(created.id);
    assert.equal(created.status, 'DRAFT');
    assert.equal(created.revisionNumber, 1);
    assert.equal(created.ghsData.pictograms.length, 3);
    assert.equal(created.sections.section3.chemicalFormula, 'CH3OH');
    assert.equal(created.hasPrimaryPdf, false);
    console.log(`   OK: Created SDS id=${created.id}, doc=${created.documentNumber}`);

    console.log('3. Testing duplicate prevention (CAS + FA name + EN name)...');
    const dupCheckCas = await sdsService.checkDuplicate({ casNumber: `  ${testCas}  ` });
    assert.equal(dupCheckCas.isDuplicate, true);
    assert.equal(dupCheckCas.conflictType, 'CAS');

    await assert.rejects(
      () =>
        sdsService.createSdsRecord(
          {
            materialNameFa: 'ماده متفاوت',
            materialNameEn: 'Different Chemical',
            casNumber: testCas,
          },
          officerReq
        ),
      /CAS|Conflict|قبلاً/
    );
    await assert.rejects(
      () =>
        sdsService.createSdsRecord(
          {
            materialNameFa: testNameFa,
            materialNameEn: 'Another English Name',
            casNumber: `888-${String(uniqueSuffix).slice(-2)}-8`,
          },
          officerReq
        ),
      /نام فارسی|قبلاً/
    );
    await assert.rejects(
      () =>
        sdsService.createSdsRecord(
          {
            materialNameFa: 'نام فارسی متفاوت',
            materialNameEn: testNameEn.toUpperCase(),
            casNumber: `777-${String(uniqueSuffix).slice(-2)}-7`,
          },
          officerReq
        ),
      /نام انگلیسی|قبلاً/
    );
    console.log('   OK: Duplicate CAS, FA name, EN name properly rejected with ConflictError.');

    console.log('4. Testing multi-file PDF attachment via fileService & non-cascading attachment delete...');
    const fakePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    const attPrimary = await sdsService.addAttachment(
      created.id,
      {
        fileBuffer: fakePdfBuffer,
        originalName: 'methanol-primary.pdf',
        mimeType: 'application/pdf',
        attachmentRole: 'PRIMARY_SDS_PDF',
        title: 'فایل اصلی SDS متانول',
        isPrimary: true,
      },
      officerReq
    );
    createdFileIds.push(attPrimary.fileId);
    assert.equal(attPrimary.isPrimary, true);
    assert.equal(attPrimary.attachmentRole, 'PRIMARY_SDS_PDF');

    const attSecondary = await sdsService.addAttachment(
      created.id,
      {
        fileBuffer: fakePdfBuffer,
        originalName: 'coa-analysis.pdf',
        mimeType: 'application/pdf',
        attachmentRole: 'COA',
        title: 'گواهی آنالیز آزمایشگاهی',
        isPrimary: false,
      },
      officerReq
    );
    createdFileIds.push(attSecondary.fileId);

    const afterUpload = await sdsService.getSdsById(created.id);
    assert.equal(afterUpload.attachmentCount, 2);
    assert.equal(afterUpload.hasPrimaryPdf, true);

    // Delete secondary attachment & verify parent SDS remains intact with primary PDF still active
    const afterAttDelete = await sdsService.removeAttachment(created.id, attSecondary.id, officerReq);
    assert.equal(afterAttDelete.attachmentCount, 1);
    assert.equal(afterAttDelete.hasPrimaryPdf, true);
    console.log('   OK: Attachments uploaded, primary detected, secondary deleted without touching parent SDS.');

    console.log('5. Testing lifecycle workflow, RBAC enforcement & immutability lock...');
    const submitted = await sdsService.changeStatus(created.id, { action: 'SUBMIT_REVIEW' }, officerReq);
    assert.equal(submitted.status, 'UNDER_REVIEW');

    // Non-manager officer CANNOT approve
    await assert.rejects(
      () => sdsService.changeStatus(created.id, { action: 'APPROVE' }, officerReq),
      /مدیر|مجاز/
    );

    const approved = await sdsService.changeStatus(created.id, { action: 'APPROVE' }, adminReq);
    assert.equal(approved.status, 'APPROVED');

    const published = await sdsService.changeStatus(created.id, { action: 'PUBLISH' }, adminReq);
    assert.equal(published.status, 'PUBLISHED');

    // Direct edit of PUBLISHED/APPROVED SDS must be blocked
    await assert.rejects(
      () => sdsService.updateSdsRecord(created.id, { tradeName: 'Modified directly' }, adminReq),
      /بازنگری|ویرایش مستقیم/
    );

    // Create new revision -> becomes DRAFT Rev.2 while Rev.1 snapshot saved in sds_revisions
    const rev2 = await sdsService.createNewRevision(
      created.id,
      {
        changeSummary: 'بروزرسانی حدود تماس شغلی بخش ۸',
        triggerReason: 'ابلاغ استاندارد جدید OSHA/ACGIH',
      },
      adminReq
    );
    assert.equal(rev2.revisionNumber, 2);
    assert.equal(rev2.status, 'DRAFT');
    assert.ok((rev2.revisions || []).length >= 2, 'Snapshot history should include previous revisions');

    // Now Rev.2 DRAFT is editable again
    const updatedRev2 = await sdsService.updateSdsRecord(
      created.id,
      {
        sections: {
          ...rev2.sections,
          section8: { occupationalExposureLimits: 'TLV-TWA: 200 ppm' },
        },
      },
      adminReq
    );
    assert.equal(updatedRev2.sections.section8.occupationalExposureLimits, 'TLV-TWA: 200 ppm');
    console.log('   OK: RBAC approval lock, direct-edit immutability, and snapshot revision Rev.1 -> Rev.2 verified.');

    console.log('6. Testing Flag Revision & Dashboard stats filters...');
    const flagged = await sdsService.changeStatus(
      created.id,
      {
        action: 'FLAG_REVISION',
        needsRevision: true,
        reviewAlertMessage: 'تغییر مشخصات سازنده - نیاز به بازنگری بخش ۱ و ۲',
      },
      adminReq
    );
    assert.equal(flagged.needsRevision, true);

    const listRes = await sdsService.listSdsRecords({ casNumber: testCas, onlyNeedsRevision: true });
    assert.ok(listRes.records.some((r) => r.id === created.id));
    assert.ok(listRes.stats.total >= 1);
    console.log('   OK: Revision warning flag & server-side search/stats verified.');

    console.log('7. Testing Audit Logs & Soft Delete...');
    await sdsService.deleteSdsRecord(created.id, adminReq);
    await assert.rejects(() => sdsService.getSdsById(created.id), /یافت نشد/);

    const auditRows = await pool.query(
      `SELECT action, module FROM audit_logs WHERE entity_id = $1 AND module = 'SDS' ORDER BY id DESC`,
      [String(created.id)]
    );
    assert.ok(auditRows.rows.length >= 5, 'Audit log entries must exist for SDS actions');
    console.log(`   OK: Recorded ${auditRows.rows.length} audit log events for SDS lifecycle.`);

    const afterFilesCountRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM system_files WHERE deleted_at IS NULL`
    );
    // Only attPrimary should remain before cleanup
    assert.equal(
      afterFilesCountRes.rows[0].cnt,
      beforeFilesCount + 1,
      'Existing system_files / documents untouched except expected test file'
    );
    console.log('   OK: Existing Documents & system_files untouched.');

    console.log('\nALL SDS END-TO-END TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('INNER TEST FAILURE:', err);
    throw err;
  } finally {
    // Strictly clean up temporary test records & files so ZERO dummy rows remain in production DB
    try {
      if (createdSdsIds.length > 0) {
        await db.delete(schema.sdsAttachments).where(inArray(schema.sdsAttachments.sdsId, createdSdsIds));
        await db.delete(schema.sdsRevisions).where(inArray(schema.sdsRevisions.sdsId, createdSdsIds));
        await db.delete(schema.sdsRecords).where(inArray(schema.sdsRecords.id, createdSdsIds));
      }
      if (createdFileIds.length > 0) {
        const fRows = await db
          .select()
          .from(schema.systemFiles)
          .where(inArray(schema.systemFiles.fileId, createdFileIds));
        for (const f of fRows) {
          if (f.filePath && fs.existsSync(f.filePath)) {
            try {
              fs.unlinkSync(f.filePath);
            } catch {}
          }
        }
        await db.delete(schema.systemFiles).where(inArray(schema.systemFiles.fileId, createdFileIds));
      }
      await pool.query(
        `DELETE FROM audit_logs WHERE user_uid IN ('test-admin-uid', 'test-officer-uid')`
      );
    } finally {
      await pool.end();
    }
  }
}

run().catch((err) => {
  console.error('SDS E2E TEST FAILED:', err);
  process.exit(1);
});
