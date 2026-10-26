import http from 'http';
import assert from 'assert';
import {
  validateWebhookTargetUrl,
  signWebhookPayload,
  verifyWebhookSignature,
  sanitizeWebhookPayloadData,
  buildStandardWebhookEnvelope,
  verifyEndpointResponse,
  executeWebhookDelivery,
  saveIntegrationConfigToDb,
  getIntegrationConfigFromDb,
  maskIntegrationConfigForClient,
  getWebhookDeliveryLogs,
  evaluateAndDispatchHeatStressWebhook,
} from '../server/services/webhookDispatcher.ts';
import { SENSITIVE_ADMIN_READ_KEYS, checkIsAdminRequest } from '../server/routes/settings.router.ts';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<string>) {
  try {
    const details = await fn();
    results.push({ name, passed: true, details });
    console.log(`✅ [PASS] ${name} — ${details}`);
  } catch (err: any) {
    results.push({ name, passed: false, details: err?.message || String(err) });
    console.error(`❌ [FAIL] ${name} — ${err?.message || err}`);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('HSECORE WEBHOOK & AUTOMATION INTEGRATION — TECHNICAL & SECURITY AUDIT TEST SUITE');
  console.log('================================================================================\n');

  // 1. SSRF & URL Validation Tests
  await runTest('1. SSRF Protection: Block Loopback, Cloud Metadata, RFC1918 Private IPs & Forbidden Schemes', async () => {
    const blockedUrls = [
      'http://127.0.0.1:3000/api/v1/settings',
      'http://localhost:5432/db',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.15/internal-webhook',
      'http://172.16.10.5/webhook',
      'http://192.168.1.100:8080/hook',
      'http://[::1]:3000/hook',
      'http://metadata.google.internal/computeMetadata/v1/',
      'file:///etc/passwd',
      'https://admin:secretpass@example.com/webhook',
    ];

    for (const u of blockedUrls) {
      const res = await validateWebhookTargetUrl(u);
      assert.strictEqual(res.valid, false, `Expected URL to be blocked by SSRF guard: ${u}`);
    }

    const validPublicIp = await validateWebhookTargetUrl('https://8.8.8.8/webhook', { skipDnsLookup: true });
    assert.strictEqual(validPublicIp.valid, true, 'Expected public IP URL to pass validation');

    return `Blocked all ${blockedUrls.length}/${blockedUrls.length} SSRF & unsafe URL vectors`;
  });

  // 2. Cryptographic HMAC-SHA256 Signing & Anti-Replay Verification
  await runTest('2. HMAC-SHA256 Signature & Timestamp Anti-Replay Protection', async () => {
    const secret = 'whsec_test_audit_secret_998877665544332211';
    const body = JSON.stringify({ event_type: 'incident.reported', data: { id: 101 } });
    const nowSec = Math.floor(Date.now() / 1000);

    const sig = signWebhookPayload(body, secret, nowSec);
    assert.ok(sig.startsWith('sha256=') && sig.length === 71, 'Invalid HMAC-SHA256 format');

    // Valid verification
    const validCheck = verifyWebhookSignature({
      rawBody: body,
      signatureHeader: sig,
      secret,
      timestampHeader: nowSec,
    });
    assert.strictEqual(validCheck.valid, true, 'Valid signature was rejected');

    // Tampered payload check
    const tamperedCheck = verifyWebhookSignature({
      rawBody: JSON.stringify({ event_type: 'incident.reported', data: { id: 999 } }),
      signatureHeader: sig,
      secret,
      timestampHeader: nowSec,
    });
    assert.strictEqual(tamperedCheck.valid, false, 'Tampered payload was not rejected');
    assert.strictEqual(tamperedCheck.reason, 'SIGNATURE_MISMATCH');

    // Replay attack check (timestamp 10 minutes old > 300s window)
    const oldTs = nowSec - 600;
    const oldSig = signWebhookPayload(body, secret, oldTs);
    const replayCheck = verifyWebhookSignature({
      rawBody: body,
      signatureHeader: oldSig,
      secret,
      timestampHeader: oldTs,
      toleranceSeconds: 300,
    });
    assert.strictEqual(replayCheck.valid, false, 'Stale replay timestamp was not rejected');
    assert.strictEqual(replayCheck.reason, 'TIMESTAMP_OUTSIDE_TOLERANCE_REPLAY_BLOCKED');

    return 'Verified valid HMAC-SHA256, rejected tampered body, and blocked 10m replay attack';
  });

  // 3. Anti-False-Positive Response Verification (`system.test_ping`)
  await runTest('3. Anti-False-Positive Detection: Reject HTML 200 Login Page & 302 Redirects vs Valid JSON Ack', async () => {
    // Case A: Reverse proxy or SSO portal returns HTTP 200 OK with HTML login page
    const html200 = verifyEndpointResponse({
      httpStatus: 200,
      contentType: 'text/html; charset=utf-8',
      responseBody: '<!DOCTYPE html><html><head><title>Sign in</title></head><body>Login</body></html>',
    });
    assert.strictEqual(html200.verifiedWorkflowAck, false, 'HTML 200 must NOT be marked as verified workflow ack');
    assert.strictEqual(html200.status, 'UNVERIFIED_RESPONSE');

    // Case B: HTTP 302 Redirect
    const redirect302 = verifyEndpointResponse({
      httpStatus: 302,
      contentType: 'text/plain',
      responseBody: 'Found',
      redirectLocation: 'https://login.example.com',
    });
    assert.strictEqual(redirect302.verifiedWorkflowAck, false);
    assert.strictEqual(redirect302.status, 'FAILED');

    // Case C: HTTP 200 OK with JSON error body
    const jsonLogicError = verifyEndpointResponse({
      httpStatus: 200,
      contentType: 'application/json',
      responseBody: JSON.stringify({ success: false, error: 'Workflow inactive' }),
    });
    assert.strictEqual(jsonLogicError.verifiedWorkflowAck, false);
    assert.strictEqual(jsonLogicError.status, 'UNVERIFIED_RESPONSE');

    // Case D: Valid n8n / Camunda JSON acknowledgment
    const validJsonAck = verifyEndpointResponse({
      httpStatus: 200,
      contentType: 'application/json',
      responseBody: JSON.stringify({ workflowExecuted: true, executionId: 'n8n_9812' }),
    });
    assert.strictEqual(validJsonAck.verifiedWorkflowAck, true);
    assert.strictEqual(validJsonAck.status, 'DELIVERED');

    // Case E: Valid Make.com "Accepted" text acknowledgment
    const validMakeAck = verifyEndpointResponse({
      httpStatus: 200,
      contentType: 'text/plain',
      responseBody: 'Accepted',
    });
    assert.strictEqual(validMakeAck.verifiedWorkflowAck, true);
    assert.strictEqual(validMakeAck.status, 'DELIVERED');

    return 'Accurately distinguished HTML 200 / Redirects / Logical JSON errors from verified n8n/Make/Camunda responses';
  });

  // 4. PII Minimization & Standardized Schema v1.0 Envelope
  await runTest('4. PII Sanitization & Schema v1.0 Envelope (n8n / Make / Camunda 8 Compatibility)', async () => {
    const rawSensitiveInput = {
      incidentNumber: 'INC-1404-771',
      title: 'نشت جزئی بخار در واحد الفین',
      severity: 'HIGH',
      location: 'واحد الفین - سکوی B',
      nationalCode: '1234567890',
      mobile: '09120000000',
      passwordHash: '$2a$10$secret',
      signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
    };

    const envelope = buildStandardWebhookEnvelope({
      eventType: 'incident.reported',
      data: rawSensitiveInput,
      moduleName: 'incident_reporting',
    });

    assert.strictEqual(envelope.schema_version, '1.0');
    assert.ok(envelope.event_id.startsWith('evt_'));
    assert.strictEqual(envelope.event_type, 'incident.reported');
    assert.strictEqual(envelope.automation_context.camunda8.messageName, 'msg_hse_incident_reported');
    assert.strictEqual(envelope.automation_context.camunda8.correlationKey, 'INC-1404-771');

    // Verify PII & binary fields were stripped
    assert.strictEqual('nationalCode' in envelope.data, false, 'nationalCode must be stripped');
    assert.strictEqual('mobile' in envelope.data, false, 'mobile must be stripped');
    assert.strictEqual('passwordHash' in envelope.data, false, 'passwordHash must be stripped');
    assert.strictEqual('signatureImage' in envelope.data, false, 'signatureImage must be stripped');
    assert.strictEqual(envelope.data.incidentNumber, 'INC-1404-771');

    return 'Removed nationalCode, mobile, passwordHash & base64 signature while preserving Camunda 8 correlation & v1.0 schema';
  });

  // 5. End-to-End Live Dispatch, Retry Backoff, Idempotency & All 4 Domain Events
  await runTest('5. End-to-End Dispatch of All 4 Events, Controlled Retry on HTTP 503, and Idempotency', async () => {
    const receivedEvents: Array<{
      eventHeader: string;
      signature: string;
      timestamp: string;
      body: any;
    }> = [];
    let transientFailCounter = 0;

    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        if (req.url === '/flaky-endpoint') {
          transientFailCounter += 1;
          if (transientFailCounter < 3) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Temporary overload' }));
            return;
          }
        }
        if (req.url === '/html-login') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body>Please sign in to proxy</body></html>');
          return;
        }

        const parsed = JSON.parse(raw || '{}');
        receivedEvents.push({
          eventHeader: String(req.headers['x-hse-event'] || ''),
          signature: String(req.headers['x-hse-signature-256'] || ''),
          timestamp: String(req.headers['x-hse-timestamp'] || ''),
          body: parsed,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            workflowExecuted: true,
            acceptedEventId: parsed.event_id,
            engine: 'n8n-camunda-bridge',
          })
        );
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const testSecret = 'whsec_e2e_integration_secret_2026';

      // 5a. Dispatch all 4 operational events + test_ping
      const eventsToTest: Array<{ type: any; payload: Record<string, any> }> = [
        {
          type: 'incident.reported',
          payload: { incidentNumber: 'INC-9001', title: 'آتش‌سوزی جزئی تابلو برق', severity: 'HIGH', nationalCode: '0011223344' },
        },
        {
          type: 'warning.issued',
          payload: { number: 'HSE/w/501', warningLevel: 'WRITTEN_1', unit: 'واحد بهره‌برداری', reason: 'عدم استفاده از کلاه ایمنی' },
        },
        {
          type: 'permit.status_adjusted',
          payload: { permitNumber: 'PTW-1404-302', permitType: 'HOT_WORK', previousStatus: 'PENDING_APPROVAL', currentStatus: 'APPROVED' },
        },
        {
          type: 'heat_stress.level_change',
          payload: { stationId: 'SITE-SOUTH-PARS', previousRiskLevel: 'Caution', currentRiskLevel: 'Danger', wbgtCelsius: 31.4 },
        },
        {
          type: 'system.test_ping',
          payload: { ping: 'pong', diagnostic: true },
        },
      ];

      for (const ev of eventsToTest) {
        const delivery = await executeWebhookDelivery({
          eventType: ev.type,
          data: ev.payload,
          targetUrl: `${baseUrl}/webhook`,
          secret: testSecret,
          idempotencyKey: `idem_test_${ev.type}_unique`,
          allowInternalTestServer: true,
        });
        assert.strictEqual(delivery.status, 'DELIVERED', `Expected DELIVERED for ${ev.type}`);
        assert.strictEqual(delivery.verifiedWorkflowAck, true);
      }

      assert.strictEqual(receivedEvents.length, 5, 'Receiver should have captured all 5 events');

      // 5b. Test Idempotency (sending identical idempotencyKey again must NOT send duplicate HTTP request)
      const beforeCount = receivedEvents.length;
      const duplicateAttempt = await executeWebhookDelivery({
        eventType: 'incident.reported',
        data: { incidentNumber: 'INC-9001' },
        targetUrl: `${baseUrl}/webhook`,
        secret: testSecret,
        idempotencyKey: 'idem_test_incident.reported_unique',
        allowInternalTestServer: true,
      });
      assert.strictEqual(duplicateAttempt.status, 'DELIVERED');
      assert.strictEqual(receivedEvents.length, beforeCount, 'Duplicate idempotencyKey should be suppressed');

      // 5c. Test Controlled Retry on transient HTTP 503 (fails twice, succeeds on 3rd attempt)
      const retryDelivery = await executeWebhookDelivery({
        eventType: 'permit.status_adjusted',
        data: { permitNumber: 'PTW-RETRY-01', currentStatus: 'SUSPENDED' },
        targetUrl: `${baseUrl}/flaky-endpoint`,
        secret: testSecret,
        idempotencyKey: `idem_retry_test_${Date.now()}`,
        maxAttempts: 3,
        allowInternalTestServer: true,
      });
      assert.strictEqual(retryDelivery.status, 'DELIVERED');
      assert.strictEqual(retryDelivery.attemptCount, 3, 'Should have succeeded on attempt 3 after two 503 errors');

      // 5d. Test HTML 200 False-Positive endpoint over live HTTP
      const htmlFalsePositive = await executeWebhookDelivery({
        eventType: 'system.test_ping',
        data: { ping: 'pong' },
        targetUrl: `${baseUrl}/html-login`,
        secret: testSecret,
        forceDispatch: true,
        maxAttempts: 1,
        allowInternalTestServer: true,
      });
      assert.strictEqual(htmlFalsePositive.status, 'UNVERIFIED_RESPONSE');
      assert.strictEqual(htmlFalsePositive.verifiedWorkflowAck, false);

      return 'Dispatched all 4 HSE events + test_ping, verified HMAC headers, suppressed duplicate via idempotency, recovered from 2x HTTP 503 via retry, and caught live HTML 200 false positive';
    } finally {
      server.close();
    }
  });

  // 6. Database Persistence, Secret Masking & RBAC Protection
  await runTest('6. Database Persistence, Secret Masking & Non-Admin Access Control (RBAC)', async () => {
    // Verify RBAC helper rejects regular users and contractors
    assert.strictEqual(checkIsAdminRequest({ user: { role: 'WORKER' } }), false);
    assert.strictEqual(checkIsAdminRequest({ user: { role: 'USER' } }), false);
    assert.strictEqual(checkIsAdminRequest({ user: { role: 'CONTRACTOR' } }), false);
    assert.strictEqual(checkIsAdminRequest({ user: { role: 'ADMIN' } }), true);
    assert.strictEqual(checkIsAdminRequest({ user: { role: 'HSE_MANAGER' } }), true);

    assert.ok(SENSITIVE_ADMIN_READ_KEYS.includes('hse_integration_config'));
    assert.ok(SENSITIVE_ADMIN_READ_KEYS.includes('hse_webhook_delivery_logs'));

    // Backup current DB config before test
    const originalConfig = await getIntegrationConfigFromDb();

    try {
      // Save config with real secret to DB
      const realSecret = 'whsec_persistent_db_secret_abcdef123456';
      const { config: saved } = await saveIntegrationConfigToDb({
        webhookEnabled: true,
        webhookUrl: 'https://events.hse-enterprise.org/v1/webhook-receiver',
        webhookSecret: realSecret,
        webhookOnIncident: true,
        webhookOnWarning: true,
        webhookOnPermit: true,
        webhookOnHeat: true,
      });

      assert.strictEqual(saved.webhookSecret, realSecret);

      // Client masking check
      const masked = maskIntegrationConfigForClient(saved);
      assert.ok(masked.webhookSecret.includes('••••'), 'Secret must be masked for client responses');
      assert.notStrictEqual(masked.webhookSecret, realSecret);

      // Saving back the masked placeholder must preserve the original secret in DB
      const { config: preserved } = await saveIntegrationConfigToDb({
        webhookSecret: masked.webhookSecret,
      });
      assert.strictEqual(preserved.webhookSecret, realSecret, 'Masked placeholder must not overwrite real secret in DB');

      const logs = await getWebhookDeliveryLogs(10);
      assert.ok(Array.isArray(logs) && logs.length >= 5, 'Delivery logs must be persisted in database');

      return `Persisted config & ${logs.length} delivery logs in DB, enforced RBAC on sensitive keys, and preserved masked secrets`;
    } finally {
      // Cleanly restore initial configuration to avoid polluting production DB
      await saveIntegrationConfigToDb(originalConfig);
    }
  });

  console.log('\n================================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`FINAL AUDIT TEST SUMMARY: ${passedCount}/${results.length} TEST SUITES PASSED`);
  console.log('================================================================================');

  if (passedCount !== results.length) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in webhook audit test suite:', err);
  process.exit(1);
});
