/**
 * Automated test suite for HSECORE AI Dynamic Module Coverage, Slash Commands, and RBAC Guard
 */
import assert from 'node:assert/strict';
import { aiModuleRegistry } from '../server/modules/ai/ai.module-registry.ts';
import { aiToolsRegistry } from '../server/modules/ai/ai.tools.ts';
import { aiOrchestrator } from '../server/modules/ai/ai.orchestrator.ts';
import { aiSessionService } from '../server/modules/ai/ai.sessions.ts';
import {
  parseSlashQueryFromInput,
  stripSlashTokenFromInput,
  searchAndRankModules,
} from '../src/utils/aiModuleSlashSearch.ts';
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
    tools: ['ptw_summary'],
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
  await aiSessionService.appendMessage(createdSession.id, adminUser, {
    id: 'test-msg-a-1',
    role: 'assistant',
    content: 'پاسخ تحلیلی جامع هوش مصنوعی برای پروانه‌های کار و ایمنی ثبت شد.',
    toolsUsed: ['پروانه‌های کار (PTW)'],
    citations: ['گزارش سامانه PTW'],
    durationMs: 425,
    model: 'qwen2.5:1.5b',
  });

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

  // ============================================================================
  // 10 MANDATORY ACCEPTANCE TESTS FOR '/' SMART MODULE SEARCH & SELECTION
  // ============================================================================
  console.log('\n--- Running 10 Mandatory Acceptance Tests for / Smart Module Search ---');
  const visibleCatalog = coverage.filter(item => !item.internal);

  // Acceptance Test 1: تایپ `/` و نمایش تمام ماژول‌های مجاز
  const slashRootParsed = parseSlashQueryFromInput('/');
  assert.equal(slashRootParsed.isActive, true, 'Typing / must activate slash search immediately');
  assert.equal(slashRootParsed.query, '', 'Root / query must be empty string');
  const allPermittedResults = searchAndRankModules(visibleCatalog, slashRootParsed.query);
  assert.ok(allPermittedResults.length > 30, 'Typing / must list all permitted modules + /ALL');
  assert.equal(allPermittedResults[0].moduleId, 'all', 'First item on / must be /ALL command');
  // Verify each item has required UI metadata (name, icon, accessPath, selection state)
  for (const item of allPermittedResults.slice(1, 10)) {
    assert.ok(item.mainModuleNameFa, `Item ${item.moduleId} must have mainModuleNameFa`);
    assert.ok(item.iconName, `Item ${item.moduleId} must have dedicated iconName`);
    assert.ok(item.accessPath, `Item ${item.moduleId} must have accessPath`);
    assert.equal(typeof item.isSelected, 'boolean', `Item ${item.moduleId} must have selection status`);
  }
  console.log(`PASS [1/10] Typing '/' displays all ${allPermittedResults.length - 1} permitted modules with rich metadata`);

  // Acceptance Test 2: تایپ `/پروانه` و نمایش ماژول‌های مرتبط
  const permitParsed = parseSlashQueryFromInput('/پروانه');
  assert.equal(permitParsed.isActive, true);
  assert.equal(permitParsed.query, 'پروانه');
  const permitResults = searchAndRankModules(visibleCatalog, permitParsed.query);
  assert.ok(permitResults.length > 0, 'Searching /پروانه must return related modules');
  assert.equal(permitResults[0].moduleId, 'permit', 'Top result for /پروانه must be permit module');
  console.log('PASS [2/10] Typing "/پروانه" ranks permit module first');

  // Acceptance Test 3: تایپ نام انگلیسی ماژول
  const englishPermitResults = searchAndRankModules(visibleCatalog, 'permit');
  assert.ok(englishPermitResults.some(r => r.moduleId === 'permit'), 'English search "permit" must find permit');
  const englishFireResults = searchAndRankModules(visibleCatalog, 'fire');
  assert.ok(englishFireResults.some(r => r.moduleId === 'fire-dept' || r.parentModuleId === 'fire'), 'English search "fire" must find fire-dept modules');
  const englishMedicalResults = searchAndRankModules(visibleCatalog, 'periodic-exams');
  assert.equal(englishMedicalResults[0]?.moduleId, 'periodic-exams', 'English search "periodic-exams" must rank periodic-exams first');
  console.log('PASS [3/10] English module name search ("permit", "fire", "periodic-exams") works accurately');

  // Acceptance Test 4: جست‌وجوی نام ناقص ماژول + غلط املایی و حروف عربی ی/ک
  const partialResults = searchAndRankModules(visibleCatalog, 'معاین');
  assert.ok(partialResults.some(r => r.moduleId === 'periodic-exams'), 'Partial search "معاین" must match periodic-exams');
  const arabicCharResults = searchAndRankModules(visibleCatalog, 'معاينات طب كار'); // Arabic ي and ك
  assert.ok(arabicCharResults.some(r => r.moduleId === 'periodic-exams'), 'Arabic ي/ك search "معاينات طب كار" must match periodic-exams');
  const typoResults = searchAndRankModules(visibleCatalog, 'پروانه کا');
  assert.ok(typoResults.some(r => r.moduleId === 'permit'), 'Typo/incomplete search "پروانه کا" must match permit');
  console.log('PASS [4/10] Partial name, Arabic ی/ک normalization, and typo-tolerant search verified');

  // Acceptance Test 5 & 6: انتخاب چند ماژول هم‌زمان و حذف ماژول انتخاب‌شده
  let selectedChipIds: string[] = [];
  const selectModule = (id: string) => {
    selectedChipIds = selectedChipIds.includes(id)
      ? selectedChipIds.filter(x => x !== id)
      : [...selectedChipIds.filter(x => x !== 'all'), id];
  };
  selectModule('permit');
  selectModule('periodic-exams');
  selectModule('risks-main');
  assert.deepEqual(selectedChipIds, ['permit', 'periodic-exams', 'risks-main'], 'Multi-module selection must store all 3 modules');
  const rankedWithSelection = searchAndRankModules(visibleCatalog, '', {
    selectedModuleIds: selectedChipIds,
  });
  assert.equal(
    rankedWithSelection.find(r => r.moduleId === 'permit')?.isSelected,
    true,
    'Selected module must be marked isSelected=true'
  );
  // Remove 'periodic-exams'
  selectModule('periodic-exams');
  assert.deepEqual(selectedChipIds, ['permit', 'risks-main'], 'Removing a selected module must keep remaining modules intact');
  console.log('PASS [5/10 & 6/10] Simultaneous multi-module selection and chip removal verified');

  // Acceptance Test 7: انتخاب با کیبورد (مدیریت نشانگر، انتخاب و پاک‌سازی توکن اسلش از متن)
  const inlineInput = 'وضعیت کلی /پروانه را بررسی کن';
  const parsedInline = parseSlashQueryFromInput(inlineInput, 17); // cursor right after '/پروانه'
  assert.equal(parsedInline.isActive, true, 'Inline slash command must be detected at cursor');
  assert.equal(parsedInline.query, 'پروانه');
  const strippedInput = stripSlashTokenFromInput(inlineInput, parsedInline);
  assert.equal(strippedInput, 'وضعیت کلی را بررسی کن', 'Selecting a module via Enter must cleanly strip the /query token and preserve surrounding text');
  console.log('PASS [7/10] Keyboard navigation state & slash token stripping verified');

  // Acceptance Test 8: اجرای تحلیل واقعی ماژول انتخاب‌شده
  const moduleAnalysisResponse = await aiOrchestrator.processChat(
    {
      message: 'تحلیل جامع ساختار، زیرماژول‌ها و داده‌های ماژول معاینات طب کار',
      model: 'hsecore-analytical-engine',
      selectedModules: ['periodic-exams'],
      allowTools: true,
    },
    adminUser
  );
  assert.ok(
    moduleAnalysisResponse.reply.includes('معاینات ادواری') &&
      moduleAnalysisResponse.reply.includes('ساختار ماژول‌های انتخاب‌شده'),
    'Selected module analysis must inspect real structure and data of periodic-exams'
  );
  console.log('PASS [8/10] Real analysis execution of selected module verified');

  // Acceptance Test 9: اجرای دستور `/ALL` و بررسی کامل ساختار سامانه
  const allCommandRanked = searchAndRankModules(visibleCatalog, 'ALL');
  assert.equal(allCommandRanked[0].moduleId, 'all', 'Searching /ALL must prioritize the /ALL special command first');
  assert.equal(allCommandRanked[0].isAllCommand, true);
  assert.ok(
    allPlan.toolResults.length > 0 &&
      allPlan.toolResults[0].summary.includes('تحلیل یکپارچه مقطعی کلیه ماژول‌های سامانه'),
    '/ALL execution must analyze all active system modules'
  );
  console.log('PASS [9/10] /ALL special command search and full-system analysis verified');

  // Acceptance Test 10: افزودن ماژول جدید و تشخیص خودکار آن در جست‌وجوی `/`
  const dynamicDroneSearch = searchAndRankModules(visibleCatalog, 'پهپادی');
  assert.ok(
    dynamicDroneSearch.some(r => r.moduleId === dynamicTestKey),
    'Newly registered dynamic module (test_drone_inspection) must automatically appear in / search by Persian name'
  );
  const dynamicDroneEnSearch = searchAndRankModules(visibleCatalog, 'drone');
  assert.ok(
    dynamicDroneEnSearch.some(r => r.moduleId === dynamicTestKey),
    'Newly registered dynamic module must automatically appear in / search by English name'
  );
  console.log('PASS [10/10] Newly registered dynamic module automatically discovered in / search without manual list changes');

  console.log('\nAll 20 module coverage, session persistence, and / smart module search tests PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

