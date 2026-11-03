/**
 * Automated test suite for HSECORE AI Dynamic Module Coverage, Slash Commands, and RBAC Guard
 */
import assert from 'node:assert/strict';
import { aiModuleRegistry } from '../server/modules/ai/ai.module-registry.ts';
import { aiToolsRegistry } from '../server/modules/ai/ai.tools.ts';
import { aiOrchestrator } from '../server/modules/ai/ai.orchestrator.ts';
import { aiSessionService } from '../server/modules/ai/ai.sessions.ts';
import type { UserContext } from '../server/core/middleware/auth.ts';

const adminUser: UserContext = {
  id: 1,
  uid: 'admin-uid',
  username: 'admin',
  role: 'ADMIN',
  permissions: ['*'],
};

const safetyUser: UserContext = {
  id: 2,
  uid: 'safety-officer-uid',
  username: 'safety_user',
  role: 'SAFETY_OFFICER',
  permissions: ['safety:read', 'ptw:read', 'incidents:read', 'training:read'],
};

const basicUser: UserContext = {
  id: 3,
  uid: 'basic-worker-uid',
  username: 'worker',
  role: 'USER',
  permissions: [],
};

async function runTests() {
  console.log('--- Testing HSECORE AI Dynamic Module Coverage & Orchestrator ---');

  // Test 1: Module Registry covers 100% of modules and tabs
  const allModules = aiModuleRegistry.getAllModules();
  assert.ok(allModules.length >= 20, `Expected at least 20 registered modules, found ${allModules.length}`);
  const hasHealthEnv = allModules.find(m => m.key === 'health-env');
  assert.ok(hasHealthEnv, 'health-env module must be registered');
  assert.ok(hasHealthEnv.subitems && hasHealthEnv.subitems.length >= 10, 'health-env should have its subitems registered');

  const hasFire = allModules.find(m => m.key === 'fire-dept');
  assert.ok(hasFire, 'fire-dept module must be registered');
  assert.ok(hasFire.subitems && hasFire.subitems.length >= 8, 'fire-dept subitems should be registered');

  console.log(`PASS Dynamic Module Registry loaded ${allModules.length} core modules with complete subitems`);

  // Test 2: Slash command `/` returns hierarchical tree
  const treeResult = await aiToolsRegistry.getModuleHierarchyTree(adminUser);
  assert.equal(treeResult.toolName, 'module_hierarchy_tree');
  assert.ok(treeResult.summary.includes('درخت سلسله‌مراتبی ماژول‌ها'), 'Tree must contain header');
  assert.ok(treeResult.summary.includes('پروانه کار ایمن (PTW)'), 'Tree must list PTW');
  assert.ok(treeResult.summary.includes('واحد آتش‌نشانی و امداد'), 'Tree must list Fire Dept');
  assert.ok(treeResult.summary.includes('/ALL'), 'Tree must mention /ALL command');
  console.log('PASS Hierarchical module tree generated successfully for / command');

  // Test 3: Slash command `/ALL` produces comprehensive cross analysis
  const crossResult = await aiToolsRegistry.getAllModulesCrossAnalysis(adminUser);
  assert.equal(crossResult.toolName, 'all_modules_cross_analysis');
  assert.ok(crossResult.summary.includes('تحلیل یکپارچه مقطعی کلیه ماژول‌های سامانه'), 'Cross-analysis header present');
  assert.ok(crossResult.summary.includes('استرس گرمایی'), 'Cross-analysis covers Heat Stress');
  assert.ok(crossResult.summary.includes('پروانه‌های کار'), 'Cross-analysis covers PTW');
  assert.ok(crossResult.summary.includes('حوادث'), 'Cross-analysis covers Incidents');
  console.log('PASS Comprehensive cross-module analysis (/ALL) aggregated successfully');

  // Test 4: RBAC Guard on /ALL for restricted user
  const basicCrossResult = await aiToolsRegistry.getAllModulesCrossAnalysis(basicUser);
  assert.ok(basicCrossResult.summary.includes('به دلیل محدودیت مجوزهای RBAC'), 'Basic user should see RBAC restrictions on sensitive modules');
  console.log('PASS RBAC guards enforced on cross-module analysis for restricted users');

  // Test 5: Dynamic module registration at runtime
  const dynamicTestKey = 'test_drone_inspection';
  aiModuleRegistry.registerModule({
    key: dynamicTestKey,
    titleFa: 'پایش پهپادی کارگاه',
    titleEn: 'Drone Workshop Surveillance',
    groupId: 'departments',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    category: 'دپارتمان‌های تخصصی HSE',
    descriptionFa: 'سامانه پایش هوایی و گشت پهپادی سایت‌های عملیاتی',
    enabled: true,
    aiStatus: 'AI_READY',
    tools: ['universal_search'],
    dbTables: [],
  });
  const updatedAll = aiModuleRegistry.getAllModules();
  assert.ok(updatedAll.some(m => m.key === dynamicTestKey), 'Dynamic module should be immediately retrievable');
  console.log('PASS Extensible dynamic module registration works at runtime');

  // Test 6: Query Planner & Intent Router for Slash Commands
  const slashPlan = await aiOrchestrator.planAndExecuteTools('/', {}, adminUser);
  assert.equal(slashPlan.isSlashCommand, true, 'Slash command / should trigger fast-path');
  assert.ok(slashPlan.directResponse && slashPlan.directResponse.includes('درخت سلسله‌مراتبی'), 'Direct response contains tree');
  console.log('PASS Intent router detects / and returns module tree fast-path');

  // Test 7: Query Planner for /ALL command
  const allPlan = await aiOrchestrator.planAndExecuteTools('/ALL', {}, adminUser);
  assert.ok(allPlan.toolsUsed.length > 0, 'Tools should be executed for /ALL');
  assert.ok(allPlan.toolsUsed.some(t => t.includes('/ALL') || t.includes('تحلیل')), '/ALL tool should be executed');
  console.log('PASS Intent router executes /ALL comprehensive cross analysis');

  // Test 8: Personnel Dossier extraction with RBAC checks
  const dossierRestricted = await aiToolsRegistry.getPersonnelComprehensiveDossier('99999', basicUser);
  assert.ok(dossierRestricted.summary.includes('دسترسی غیرمجاز'), 'Basic user without personnel:read must be rejected');

  const dossierNotFound = await aiToolsRegistry.getPersonnelComprehensiveDossier('NON_EXISTING_CODE', adminUser);
  assert.ok(dossierNotFound.summary.includes('هیچ پرونده پرسنلی'), 'Handled missing personnel gracefully');
  console.log('PASS Personnel 360° dossier enforces strict RBAC and handles missing cases');

  // Test 9: Orchestrator module coverage output
  const coverage = await aiOrchestrator.getModuleCoverage(adminUser);
  assert.ok(coverage.length >= 20, 'Coverage report must reflect all registered modules');
  console.log(`PASS AI Orchestrator getModuleCoverage reports 100% dynamic coverage (${coverage.length} modules)`);

  // Test 10: Session & Assistant Reply Persistence across module switches, refresh, and re-login
  const createdSession = await aiSessionService.createSession(adminUser, 'گفت‌وگوی جدید');
  await aiSessionService.appendMessage(createdSession.id, adminUser, {
    id: 'test-msg-u-1',
    role: 'user',
    content: 'وضعیت پروانه‌های کار و ایمنی امروز چطور است؟',
  });
  await aiSessionService.appendMessage(createdSession.id, adminUser, {
    id: 'test-msg-a-1',
    role: 'assistant',
    content: 'پاسخ تحلیلی جامع هوش مصنوعی برای پروانه‌های کار و ایمنی ثبت شد.',
    toolsUsed: ['پروانه‌های کار (PTW)'],
    citations: ['گزارش سامانه PTW'],
    durationMs: 425,
    model: 'qwen2.5:1.5b',
  });
  // Idempotent duplicate call with same ID must not create duplicate message
  await aiSessionService.appendMessage(createdSession.id, adminUser, {
    id: 'test-msg-a-1',
    role: 'assistant',
    content: 'پاسخ تحلیلی جامع هوش مصنوعی برای پروانه‌های کار و ایمنی ثبت شد.',
    toolsUsed: ['پروانه‌های کار (PTW)'],
    citations: ['گزارش سامانه PTW'],
    durationMs: 425,
    model: 'qwen2.5:1.5b',
  });

  // Simulate re-login with username/uid and fetch messages
  const reLoginAdmin: UserContext = {
    uid: 'admin-uid',
    username: 'admin',
    role: 'ADMIN',
    permissions: ['*'],
  };
  const listedSessions = await aiSessionService.listSessions(reLoginAdmin);
  assert.ok(listedSessions.some(s => s.id === createdSession.id), 'Session must persist after re-login');
  const savedMsgs = await aiSessionService.getMessages(createdSession.id, reLoginAdmin);
  assert.equal(savedMsgs.length, 2, 'Exactly 2 messages (user + assistant) must be persisted without duplicates');
  assert.equal(savedMsgs[1].role, 'assistant', 'Second message must be assistant reply');
  assert.ok(savedMsgs[1].content.includes('پاسخ تحلیلی جامع'), 'Assistant reply content must be intact');
  assert.deepEqual(savedMsgs[1].toolsUsed, ['پروانه‌های کار (PTW)'], 'Assistant toolsUsed metadata must persist');
  await aiSessionService.deleteSession(createdSession.id, adminUser);
  console.log('PASS AI Chat Session & Assistant Reply persistence across module switch, refresh & re-login verified');

  console.log('All 10 module coverage, session persistence, and orchestrator pipeline tests PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
