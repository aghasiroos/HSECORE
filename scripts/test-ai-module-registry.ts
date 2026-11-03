import assert from 'node:assert/strict';
import {
  getAIModuleToolNames,
  getSelectedModuleDescriptions,
  type AIModuleCatalogItem,
} from '../server/modules/ai/ai.module-registry.ts';

const catalog: AIModuleCatalogItem[] = [
  {
    moduleId: 'ptw',
    moduleNameFa: 'پروانه کار ایمن',
    titleEn: 'Permit to Work',
    connected: true,
    allowed: true,
    enabled: true,
    tools: ['ptw_summary'],
    assistantIds: ['GENERAL_HSE'],
    children: [
      {
        moduleId: 'ptw:ptw-audit',
        moduleNameFa: 'ممیزی پروانه کار',
        titleEn: 'PTW Audit',
        parentId: 'ptw',
        connected: false,
        allowed: true,
        enabled: true,
        tools: [],
        assistantIds: ['GENERAL_HSE'],
        notes: 'Adapter اختصاصی ممیزی متصل نیست.',
      },
    ],
  },
  {
    moduleId: 'health-env',
    moduleNameFa: 'بهداشت و محیط زیست',
    titleEn: 'Health & Environment',
    connected: false,
    allowed: true,
    enabled: true,
    tools: [],
    assistantIds: ['GENERAL_HSE'],
    children: [
      {
        moduleId: 'health-env:periodic-exams',
        moduleNameFa: 'معاینات ادواری',
        titleEn: 'Periodic Exams',
        parentId: 'health-env',
        connected: true,
        allowed: true,
        enabled: true,
        tools: ['health_medical_summary'],
        assistantIds: ['GENERAL_HSE'],
        children: [
          {
            moduleId: 'health-env:periodic-exams:lab',
            moduleNameFa: 'آزمایشگاه',
            titleEn: 'Laboratory',
            parentId: 'health-env:periodic-exams',
            connected: true,
            allowed: true,
            enabled: true,
            tools: ['health_medical_summary'],
            assistantIds: ['GENERAL_HSE'],
          },
        ],
      },
    ],
  },
  {
    moduleId: 'user-mgmt',
    moduleNameFa: 'مدیریت کاربران',
    titleEn: 'User Management',
    connected: false,
    allowed: false,
    enabled: true,
    tools: [],
    assistantIds: ['GENERAL_HSE'],
    notes: 'بدون مجوز',
  },
];

const selectedIds = [
  'ptw',
  'ptw:ptw-audit',
  'health-env:periodic-exams',
  'health-env:periodic-exams:lab',
  'user-mgmt',
];

assert.deepEqual(
  getAIModuleToolNames(selectedIds, catalog),
  ['ptw_summary', 'health_medical_summary'],
  'nested selections must resolve tools recursively, deduplicate adapters, and exclude denied modules',
);

const descriptions = getSelectedModuleDescriptions(selectedIds, catalog);
assert.deepEqual(descriptions.selected, [
  'پروانه کار ایمن',
  'ممیزی پروانه کار',
  'معاینات ادواری',
  'آزمایشگاه',
  'مدیریت کاربران',
]);
assert.deepEqual(descriptions.connected, [
  'پروانه کار ایمن',
  'معاینات ادواری',
  'آزمایشگاه',
]);
assert.equal(descriptions.unavailable.length, 2);
assert.ok(descriptions.unavailable.some(item => item.includes('Adapter اختصاصی ممیزی')));
assert.ok(descriptions.unavailable.some(item => item.includes('بدون مجوز')));

console.log('PASS AI module registry: recursive selection, adapter deduplication, and access-aware coverage.');
