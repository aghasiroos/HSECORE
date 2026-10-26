import { XMLParser } from 'fast-xml-parser';
import { db, schema } from '../../core/db.ts';
import { eq } from 'drizzle-orm';
import type {
  WorkflowApprover,
  WorkflowInstance,
  WorkflowTask,
  WorkflowStep
} from '../../../src/modules/process-management/types.ts';

export type { WorkflowApprover, WorkflowInstance, WorkflowTask };

export interface WorkflowDefinition {
  id: string;
  name: string;
  module_type: string;
  category: 'safety' | 'operations' | 'health' | 'fire' | 'training' | 'audit' | 'environment';
  descriptionFa: string;
  descriptionEn: string;
  version: number;
  is_active: boolean;
  slaHours: number;
  roles: string[];
  steps: WorkflowStep[];
  xml_data: string;
  createdAt: string;
}

export const DB = {
  Workflows: new Map<string, WorkflowDefinition>(),
  WorkflowInstances: new Map<string, WorkflowInstance>(),
  Tasks: new Map<string, WorkflowTask>(),
  AutomationRules: new Map<string, any>()
};

function generateBpmnXml(processId: string, processName: string, steps: { id: string; titleFa: string }[]): string {
  let tasksXml = '';
  let flowsXml = '';
  let diXml = '';

  let prevId = 'StartEvent_1';
  let currentX = 180;
  const currentY = 160;

  diXml += `
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="${currentX}" y="${currentY}" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${currentX - 10}" y="${currentY + 45}" width="56" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;

  steps.forEach((step, idx) => {
    const taskId = `Activity_${step.id}`;
    const flowId = `Flow_${prevId}_to_${taskId}`;
    currentX += 160;

    tasksXml += `\n    <bpmn:userTask id="${taskId}" name="${step.titleFa}">
      <bpmn:incoming>${flowId}</bpmn:incoming>
      <bpmn:outgoing>${idx === steps.length - 1 ? 'Flow_to_End' : `Flow_${taskId}_to_Activity_${steps[idx + 1].id}`}</bpmn:outgoing>
    </bpmn:userTask>`;

    flowsXml += `\n    <bpmn:sequenceFlow id="${flowId}" sourceRef="${prevId}" targetRef="${taskId}" />`;

    diXml += `
      <bpmndi:BPMNShape id="${taskId}_di" bpmnElement="${taskId}">
        <dc:Bounds x="${currentX}" y="${currentY - 22}" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
        <di:waypoint x="${currentX - 60}" y="${currentY + 18}" />
        <di:waypoint x="${currentX}" y="${currentY + 18}" />
      </bpmndi:BPMNEdge>`;

    prevId = taskId;
  });

  const endX = currentX + 160;
  flowsXml += `\n    <bpmn:sequenceFlow id="Flow_to_End" sourceRef="${prevId}" targetRef="EndEvent_1" />`;
  diXml += `
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="${endX}" y="${currentY}" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${endX - 10}" y="${currentY + 45}" width="56" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_to_End_di" bpmnElement="Flow_to_End">
        <di:waypoint x="${currentX + 100}" y="${currentY + 18}" />
        <di:waypoint x="${endX}" y="${currentY + 18}" />
      </bpmndi:BPMNEdge>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn" exporter="HSE Camunda Modeler" exporterVersion="8.5.0">
  <bpmn:process id="${processId}" name="${processName}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="شروع فرآیند">
      <bpmn:outgoing>Flow_StartEvent_1_to_Activity_${steps[0]?.id || '1'}</bpmn:outgoing>
    </bpmn:startEvent>${tasksXml}
    <bpmn:endEvent id="EndEvent_1" name="اتمام و بایگانی">
      <bpmn:incoming>Flow_to_End</bpmn:incoming>
    </bpmn:endEvent>${flowsXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">${diXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

export const INITIAL_ENTERPRISE_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'wf_ptw_hot_work',
    name: 'گردش‌کار صدور پروانه کار گرم (PTW Hot Work)',
    module_type: 'ptw',
    category: 'safety',
    descriptionFa: 'گردش کار چندمرحله‌ای صدور و تایید مجوز کار گرم با تست گاز، ایزولاسیون و امضای دیجیتال مدیر HSE',
    descriptionEn: 'Official Multi-step Hot Work Permit Workflow with Gas Testing & HSE Signatures',
    version: 1,
    is_active: true,
    slaHours: 24,
    roles: ['متقاضی کار', 'کارشناس ایمنی و گازسنجی', 'سرپرست محوطه', 'مدیر HSE'],
    steps: [
      { id: 's1', titleFa: 'ثبت درخواست پروانه کار و پیوست اسناد', titleEn: 'Permit Application & Document Attachment', assignedRole: 'متقاضی کار', actionType: 'form', slaHours: 4 },
      { id: 's2', titleFa: 'ایزولاسیون، تست گاز و بازرسی محوطه', titleEn: 'Gas Test & Site Isolation Inspection', assignedRole: 'کارشناس ایمنی و گازسنجی', actionType: 'inspection', slaHours: 4 },
      { id: 's3', titleFa: 'تایید سرپرست عملیات و بهره‌برداری', titleEn: 'Operations Supervisor Approval', assignedRole: 'سرپرست محوطه', actionType: 'approval', slaHours: 6 },
      { id: 's4', titleFa: 'امضای دیجیتال و صدور نهایی توسط مدیر HSE', titleEn: 'Final Approval & Digital Signature by HSE Manager', assignedRole: 'مدیر HSE', actionType: 'signature', slaHours: 10 }
    ],
    xml_data: generateBpmnXml('wf_ptw_hot_work', 'گردش‌کار صدور پروانه کار گرم (PTW Hot Work)', [
      { id: 's1', titleFa: 'ثبت درخواست پروانه کار' },
      { id: 's2', titleFa: 'ایزولاسیون و تست گاز' },
      { id: 's3', titleFa: 'تایید سرپرست عملیات' },
      { id: 's4', titleFa: 'امضای دیجیتال مدیر HSE' }
    ]),
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf_incident_investigation',
    name: 'گردش‌کار گزارش و بررسی حوادث و شبه‌حوادث',
    module_type: 'incident',
    category: 'safety',
    descriptionFa: 'فرآیند جامع گزارش‌دهی، تشکیل تیم ریشه‌یابی علل (RCA) و تصویب اقدامات اصلاحی CAPA',
    descriptionEn: 'Incident & Near-Miss Investigation, Root Cause Analysis (RCA) & CAPA Approval',
    version: 1,
    is_active: true,
    slaHours: 48,
    roles: ['گزارش‌دهنده', 'افسر ایمنی', 'تیم ریشه‌یابی RCA', 'مدیر HSE'],
    steps: [
      { id: 's1', titleFa: 'ثبت اولیه گزارش حادثه / شبه‌حادثه', titleEn: 'Initial Incident / Near-Miss Notification', assignedRole: 'گزارش‌دهنده', actionType: 'form', slaHours: 6 },
      { id: 's2', titleFa: 'بررسی میدانی و ارزیابی شواهد', titleEn: 'Site Inspection & Evidence Collection', assignedRole: 'افسر ایمنی', actionType: 'inspection', slaHours: 12 },
      { id: 's3', titleFa: 'تحلیل علل ریشه‌ای (RCA) و تعیین اقدامات CAPA', titleEn: 'Root Cause Analysis & Corrective Actions Proposal', assignedRole: 'تیم ریشه‌یابی RCA', actionType: 'approval', slaHours: 18 },
      { id: 's4', titleFa: 'تایید نهایی و بستن پرونده توسط مدیر HSE', titleEn: 'Final Approval & Closure by HSE Manager', assignedRole: 'مدیر HSE', actionType: 'signature', slaHours: 12 }
    ],
    xml_data: generateBpmnXml('wf_incident_investigation', 'گردش‌کار گزارش و بررسی حوادث و شبه‌حوادث', [
      { id: 's1', titleFa: 'ثبت اولیه گزارش حادثه' },
      { id: 's2', titleFa: 'بررسی میدانی و ارزیابی شواهد' },
      { id: 's3', titleFa: 'تحلیل علل ریشه‌ای (RCA)' },
      { id: 's4', titleFa: 'تایید و بستن پرونده' }
    ]),
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf_occupational_health',
    name: 'فرآیند معاینات ادواری و سلامت شغلی',
    module_type: 'health',
    category: 'health',
    descriptionFa: 'گردش کار آزمایشات پاراکلینیک، پایش پرونده پزشکی و صدور گواهی سلامت توسط پزشک طب کار',
    descriptionEn: 'Periodic Occupational Health Examinations & Doctor Fitness Certificate',
    version: 1,
    is_active: true,
    slaHours: 72,
    roles: ['مسئول پذیرش درمانگاه', 'کارشناس آزمایشگاه و پاراکلینیک', 'پزشک طب کار'],
    steps: [
      { id: 's1', titleFa: 'پذیرش، نوبت‌دهی و ثبت سوابق فردی', titleEn: 'Patient Admission & Health History Entry', assignedRole: 'مسئول پذیرش درمانگاه', actionType: 'form', slaHours: 8 },
      { id: 's2', titleFa: 'ثبت نتایج آزمایشات و پاراکلینیک', titleEn: 'Lab Results, Audiometry & Spirometry', assignedRole: 'کارشناس آزمایشگاه و پاراکلینیک', actionType: 'test', slaHours: 24 },
      { id: 's3', titleFa: 'معاینه بالینی و صدور گواهی تناسب شغلی با امضای پزشک', titleEn: 'Clinical Exam & Fitness Certificate with Doctor Signature', assignedRole: 'پزشک طب کار', actionType: 'signature', slaHours: 40 }
    ],
    xml_data: generateBpmnXml('wf_occupational_health', 'فرآیند معاینات ادواری و سلامت شغلی', [
      { id: 's1', titleFa: 'پذیرش و ثبت سوابق' },
      { id: 's2', titleFa: 'نتایج آزمایشات و پاراکلینیک' },
      { id: 's3', titleFa: 'گواهی تناسب شغلی و امضای پزشک' }
    ]),
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf_fire_inspection',
    name: 'فرآیند بازرسی تجهیزات اطفاء حریق و مانور امداد',
    module_type: 'fire',
    category: 'fire',
    descriptionFa: 'پایش دوره‌ای خاموش‌کننده‌ها، فایرباکس‌ها، هایدرانت‌ها و ثبت کارنامه آمادگی آتش‌نشانی',
    descriptionEn: 'Fire Extinguishers & Systems Periodic Inspection and Drill Evaluation',
    version: 1,
    is_active: true,
    slaHours: 48,
    roles: ['بازرس آتش‌نشانی', 'فرمانده ایستگاه آتش‌نشانی'],
    steps: [
      { id: 's1', titleFa: 'بازرسی فیزیکی، وزن‌کشی و تست فشار کپسول‌ها', titleEn: 'Extinguishers Weight & Pressure Inspection', assignedRole: 'بازرس آتش‌نشانی', actionType: 'inspection', slaHours: 24 },
      { id: 's2', titleFa: 'بررسی عدم انطباق‌ها و صدور دستور شارژ/تعمیرات', titleEn: 'Non-conformities Review & Recharge/Repair Order', assignedRole: 'بازرس آتش‌نشانی', actionType: 'approval', slaHours: 12 },
      { id: 's3', titleFa: 'تایید نهایی کارنامه وضعیت توسط فرمانده آتش‌نشانی', titleEn: 'Final Equipment Readiness Endorsement by Fire Chief', assignedRole: 'فرمانده ایستگاه آتش‌نشانی', actionType: 'signature', slaHours: 12 }
    ],
    xml_data: generateBpmnXml('wf_fire_inspection', 'فرآیند بازرسی تجهیزات اطفاء حریق و مانور امداد', [
      { id: 's1', titleFa: 'بازرسی و تست فشار کپسول‌ها' },
      { id: 's2', titleFa: 'دستور شارژ و تعمیرات' },
      { id: 's3', titleFa: 'تایید فرمانده آتش‌نشانی' }
    ]),
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf_environmental_monitoring',
    name: 'فرآیند پایش زیست‌محیطی، پسماند و پساب',
    module_type: 'environment',
    category: 'environment',
    descriptionFa: 'پایش خروجی‌های پساب صنعتی، آلاینده‌های هوا و پسماندهای ویژه مطابق استانداردهای محیط‌زیست',
    descriptionEn: 'Industrial Wastewater, Air Emissions & Waste Management Compliance Monitoring',
    version: 1,
    is_active: true,
    slaHours: 72,
    roles: ['کارشناس آزمایشگاه محیط‌زیست', 'مهندس محیط‌زیست', 'رئیس اداره محیط‌زیست'],
    steps: [
      { id: 's1', titleFa: 'نمونه‌برداری و سنجش آزمایشگاهی پارامترها (COD, BOD, TSS)', titleEn: 'Sampling & Lab Analysis of Environmental Parameters', assignedRole: 'کارشناس آزمایشگاه محیط‌زیست', actionType: 'test', slaHours: 24 },
      { id: 's2', titleFa: 'تطبیق با حدود مجاز استاندارد و تحلیل مغایرت‌ها', titleEn: 'Regulatory Limits Compliance Analysis & Discrepancies', assignedRole: 'مهندس محیط‌زیست', actionType: 'form', slaHours: 24 },
      { id: 's3', titleFa: 'تایید گزارش انطباق زیست‌محیطی توسط رئیس محیط‌زیست', titleEn: 'Environmental Compliance Report Sign-off by Dept Head', assignedRole: 'رئیس اداره محیط‌زیست', actionType: 'signature', slaHours: 24 }
    ],
    xml_data: generateBpmnXml('wf_environmental_monitoring', 'فرآیند پایش زیست‌محیطی، پسماند و پساب', [
      { id: 's1', titleFa: 'نمونه‌برداری و سنجش پارامترها' },
      { id: 's2', titleFa: 'تحلیل مغایرت با استانداردها' },
      { id: 's3', titleFa: 'تایید رئیس محیط‌زیست' }
    ]),
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf_five_s_workplace',
    name: 'گردش کار ممیزی نظام آراستگی محیط کار (5S)',
    module_type: 'audit',
    category: 'audit',
    descriptionFa: 'اجرای چک‌لیست پنج‌گانه ساماندهی، نظم، پاکیزگی، استانداردسازی و انضباط در واحدهای سایت',
    descriptionEn: '5S Workplace Housekeeping Audit, Scoring & Corrective Action Tracking',
    version: 1,
    is_active: true,
    slaHours: 48,
    roles: ['ممیز 5S', 'مسئول واحد', 'سرممیز آراستگی'],
    steps: [
      { id: 's1', titleFa: 'بازرسی میدانی و ثبت امتیازات چک‌لیست ۵ اصل', titleEn: 'On-site Inspection & 5S Principles Scoring', assignedRole: 'ممیز 5S', actionType: 'inspection', slaHours: 16 },
      { id: 's2', titleFa: 'پاسخ واحد و تدوین برنامه اصلاحی ناهماهنگی‌ها', titleEn: 'Unit Response & Housekeeping Remediation Plan', assignedRole: 'مسئول واحد', actionType: 'approval', slaHours: 16 },
      { id: 's3', titleFa: 'ارزیابی نهایی و صدور گواهی دوره ممیزی ۵S', titleEn: 'Final Evaluation & 5S Period Certificate Issuance', assignedRole: 'سرممیز آراستگی', actionType: 'signature', slaHours: 16 }
    ],
    xml_data: generateBpmnXml('wf_five_s_workplace', 'گردش کار ممیزی نظام آراستگی محیط کار (5S)', [
      { id: 's1', titleFa: 'بازرسی میدانی و ثبت امتیازات' },
      { id: 's2', titleFa: 'برنامه اصلاحی واحد' },
      { id: 's3', titleFa: 'تایید و صدور گواهی ۵S' }
    ]),
    createdAt: new Date().toISOString()
  }
];

export async function persistProcessManagementData() {
  try {
    const payload = {
      workflows: Array.from(DB.Workflows.values()),
      instances: Array.from(DB.WorkflowInstances.values()),
      tasks: Array.from(DB.Tasks.values()),
      automationRules: Array.from(DB.AutomationRules.values()),
      updatedAt: new Date().toISOString()
    };
    await db
      .insert(schema.systemSettings)
      .values({
        key: 'hse_process_management_data_v1',
        value: payload,
        description: 'Persistent BPMN Process Management & Tasks Data',
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: {
          value: payload,
          description: 'Persistent BPMN Process Management & Tasks Data',
          updatedAt: new Date()
        }
      });
  } catch (e) {
    console.warn('[ProcessEngine] Notice: Could not save process data to پایگاه داده:', e);
  }
}

export async function initializeWorkflows(forceReset = false) {
  if (!forceReset) {
    try {
      const row = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'hse_process_management_data_v1'));
      if (row && row.length > 0 && row[0].value) {
        const data = row[0].value as any;
        if (data.workflows && Array.isArray(data.workflows) && data.workflows.length > 0) {
          DB.Workflows.clear();
          data.workflows.forEach((wf: WorkflowDefinition) => DB.Workflows.set(wf.id, wf));
          
          if (data.instances && Array.isArray(data.instances)) {
            DB.WorkflowInstances.clear();
            data.instances.forEach((inst: WorkflowInstance) => DB.WorkflowInstances.set(inst.id, inst));
          }
          if (data.tasks && Array.isArray(data.tasks)) {
            DB.Tasks.clear();
            data.tasks.forEach((t: WorkflowTask) => DB.Tasks.set(t.id, t));
          }
          return;
        }
      }
    } catch (err) {
      console.warn('[ProcessEngine] Could not load persisted process data from پایگاه داده, seeding defaults:', err);
    }
  }

  // Seed default workflows if empty or force reset
  DB.Workflows.clear();
  INITIAL_ENTERPRISE_WORKFLOWS.forEach(wf => DB.Workflows.set(wf.id, wf));
  persistProcessManagementData().catch(() => {});
}

// Initial bootstrap
initializeWorkflows().catch(console.error);

export function parseBPMN(xmlData: string) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const result = parser.parse(xmlData);
  
  let process = result['bpmn:definitions']?.['bpmn:process'];
  if (!process) throw new Error("Invalid BPMN XML: No process found");
  
  if (!Array.isArray(process)) {
    process = [process];
  }
  
  const elements = new Map<string, any>();
  const sequences: any[] = [];
  
  process.forEach((p: any) => {
    Object.keys(p).forEach(key => {
      const val = p[key];
      const items = Array.isArray(val) ? val : [val];
      
      items.forEach((item: any) => {
        if (!item || !item.id) return;
        
        if (key === 'bpmn:sequenceFlow') {
          sequences.push(item);
        } else {
          elements.set(item.id, { ...item, type: key });
        }
      });
    });
  });
  
  return { elements, sequences };
}

function buildTaskFromStep(
  step: WorkflowDefinition['steps'][0],
  instance: WorkflowInstance,
  now: string
): WorkflowTask {
  const taskId = `TASK-${Date.now().toString().slice(-6)}`;
  const due = new Date(Date.now() + 1000 * 60 * 60 * (step?.slaHours || 4)).toISOString();
  
  const assigneeType = step.assigneeType || (step.assignedUserIds && step.assignedUserIds.length > 0 ? 'user' : 'role');
  const approvalLogic = step.approvalLogic || 'all';

  let assigneeId: string | undefined = undefined;
  let assignee: string | undefined = undefined;
  let assigneeName: string | undefined = undefined;
  let candidateUserIds: string[] | undefined = undefined;
  let candidateUsers: WorkflowApprover[] | undefined = step.assignedUsers;
  let sequentialOrder: string[] | undefined = undefined;
  let currentSequentialIndex: number | undefined = undefined;

  let requiresSubstitute = false;
  let substituteAlert: string | undefined = undefined;

  // Check user active status: prevent routing to inactive users
  if (step.assignedUsers && step.assignedUsers.length > 0) {
    const inactiveUser = step.assignedUsers.find(u => u.accountStatus && u.accountStatus !== 'Active');
    if (inactiveUser) {
      requiresSubstitute = true;
      substituteAlert = `کاربر تأییدکننده «${inactiveUser.fullName}» (${inactiveUser.username}) در مدیریت کاربران غیرفعال شده است و نیازمند تعیین کاربر جایگزین می‌باشد.`;
    }
  }

  if (assigneeType === 'user' && step.assignedUserIds && step.assignedUserIds.length > 0) {
    candidateUserIds = [...step.assignedUserIds];
    if (approvalLogic === 'sequential') {
      sequentialOrder = [...step.assignedUserIds];
      currentSequentialIndex = 0;
      assigneeId = step.assignedUserIds[0];
      const foundUser = step.assignedUsers?.find(u => u.id === assigneeId || u.username === assigneeId);
      assignee = foundUser?.username || assigneeId;
      assigneeName = foundUser?.fullName || foundUser?.username || assigneeId;
    } else {
      // 'all' or 'any'
      if (step.assignedUserIds.length === 1) {
        assigneeId = step.assignedUserIds[0];
        const foundUser = step.assignedUsers?.find(u => u.id === assigneeId || u.username === assigneeId);
        assignee = foundUser?.username || assigneeId;
        assigneeName = foundUser?.fullName || foundUser?.username || assigneeId;
      }
    }
  }

  const task: WorkflowTask = {
    id: taskId,
    instanceId: instance.id,
    workflowId: instance.workflowId,
    workflowName: instance.workflowName,
    moduleType: instance.moduleType,
    title: instance.title,
    stepId: step.id,
    stepTitleFa: step.titleFa,
    stepTitleEn: step.titleEn,
    assignedRole: step.assignedRole || 'HSE Officer',
    assigneeType,
    assignee,
    assigneeName,
    assigneeId,
    assignedDepartment: step.assignedDepartment || instance.department,
    candidateUserIds,
    candidateUsers,
    approvalLogic,
    approvedUserIds: [],
    approvedUserNames: [],
    pendingUserIds: candidateUserIds ? [...candidateUserIds] : undefined,
    sequentialOrder,
    currentSequentialIndex,
    requiresSubstitute,
    substituteAlert,
    department: step.assignedDepartment || instance.department,
    priority: instance.priority,
    status: 'PENDING',
    variables: instance.variables,
    slaHours: step.slaHours || 4,
    creationTime: now,
    dueDate: due
  };

  return task;
}

export function startWorkflowInstance(workflowId: string, title: string, variables: any = {}, initiatorInfo: any = {}) {
  const wf = DB.Workflows.get(workflowId);
  if (!wf) throw new Error("Workflow definition not found");

  const instanceId = `INST-${Date.now().toString().slice(-6)}`;
  const firstStep = wf.steps[0] || {
    id: 's1',
    titleFa: 'گام نخست',
    titleEn: 'Step 1',
    assignedRole: 'HSE Officer',
    actionType: 'approval',
    slaHours: 4
  };
  const now = new Date().toISOString();
  const due = new Date(Date.now() + 1000 * 60 * 60 * (firstStep?.slaHours || 4)).toISOString();

  const instance: WorkflowInstance = {
    id: instanceId,
    workflowId: wf.id,
    workflowName: wf.name,
    moduleType: wf.module_type,
    title: title || `${wf.name} - ${new Date().toLocaleDateString('fa-IR')}`,
    initiator: initiatorInfo.username || 'current_user',
    initiatorName: initiatorInfo.fullName || 'کاربر جاری سیستم',
    department: initiatorInfo.department || 'واحد HSE',
    priority: variables.priority || 'medium',
    state: 'ACTIVE',
    currentStepIndex: 0,
    currentStepId: firstStep.id,
    currentStepTitleFa: firstStep.titleFa,
    currentStepRole: firstStep.assignedRole || 'HSE Officer',
    variables,
    history: [
      {
        stepId: firstStep.id,
        stepTitleFa: firstStep.titleFa,
        action: 'START',
        actor: initiatorInfo.username || 'current_user',
        actorName: initiatorInfo.fullName || 'کاربر سیستم',
        comments: variables.initialComment || 'نمونه فرآیند با موفقیت آغاز شد.',
        timestamp: now
      }
    ],
    startedAt: now,
    updatedAt: now,
    dueDate: due
  };

  DB.WorkflowInstances.set(instance.id, instance);

  // Create initial task using step configuration
  const task = buildTaskFromStep(firstStep, instance, now);
  DB.Tasks.set(task.id, task);

  return { instance, task };
}

export function processTaskAction(
  taskId: string,
  action: 'APPROVE' | 'REJECT' | 'RETURN' | 'DELEGATE' | 'COMMENT',
  actionData: {
    actor?: string;
    actorName?: string;
    comments?: string;
    delegateTo?: string;
    variables?: Record<string, any>;
  } = {}
) {
  const task = DB.Tasks.get(taskId);
  if (!task) throw new Error("Task not found");

  const instance = DB.WorkflowInstances.get(task.instanceId);
  if (!instance) throw new Error("Process instance not found");

  const workflow = DB.Workflows.get(instance.workflowId);
  if (!workflow) throw new Error("Workflow definition not found");

  const now = new Date().toISOString();

  // Merge variables
  if (actionData.variables) {
    instance.variables = { ...instance.variables, ...actionData.variables };
  }

  // Record history
  instance.history.push({
    stepId: task.stepId,
    stepTitleFa: task.stepTitleFa,
    action,
    actor: actionData.actor || 'system_user',
    actorName: actionData.actorName || 'کاربر سیستم',
    comments: actionData.comments,
    timestamp: now
  });

  instance.updatedAt = now;

  if (action === 'REJECT') {
    instance.state = 'REJECTED';
    task.status = 'REJECTED';
    return { success: true, instance, task, completed: true, outcome: 'REJECTED' };
  }

  if (action === 'RETURN') {
    // Step back to previous step
    if (instance.currentStepIndex > 0) {
      instance.currentStepIndex -= 1;
    }
    const targetStep = workflow.steps[instance.currentStepIndex];
    instance.currentStepId = targetStep.id;
    instance.currentStepTitleFa = targetStep.titleFa;
    instance.currentStepRole = targetStep.assignedRole;

    task.status = 'RETURNED';
    task.stepId = targetStep.id;
    task.stepTitleFa = targetStep.titleFa;
    task.stepTitleEn = targetStep.titleEn;
    task.assignedRole = targetStep.assignedRole;
    task.dueDate = new Date(Date.now() + 1000 * 60 * 60 * targetStep.slaHours).toISOString();

    return { success: true, instance, task, returned: true };
  }

  if (action === 'APPROVE') {
    // 1. Multi-approver: All required (همه افراد)
    if (task.assigneeType === 'user' && task.approvalLogic === 'all' && task.candidateUserIds && task.candidateUserIds.length > 1) {
      if (!task.approvedUserIds) task.approvedUserIds = [];
      if (!task.approvedUserNames) task.approvedUserNames = [];
      const actorId = actionData.actor || 'user';
      const actorName = actionData.actorName || actorId;
      if (!task.approvedUserIds.includes(actorId)) {
        task.approvedUserIds.push(actorId);
        task.approvedUserNames.push(actorName);
      }
      task.pendingUserIds = task.candidateUserIds.filter(id => !task.approvedUserIds?.includes(id));

      const isAllDone = task.candidateUserIds.every(uid => 
        task.approvedUserIds?.includes(uid) || 
        task.candidateUsers?.find(cu => cu.id === uid)?.username === actorId
      );

      if (!isAllDone && task.pendingUserIds.length > 0) {
        task.variables = { ...task.variables, ...actionData.variables };
        return {
          success: true,
          instance,
          task,
          completed: false,
          partialApproval: true,
          approvedCount: task.approvedUserIds.length,
          totalRequired: task.candidateUserIds.length,
          remainingApprovers: task.pendingUserIds
        };
      }
    }

    // 2. Multi-approver: Sequential (به ترتیب)
    if (task.assigneeType === 'user' && task.approvalLogic === 'sequential' && task.sequentialOrder && task.sequentialOrder.length > 1) {
      const nextIdx = (task.currentSequentialIndex || 0) + 1;
      if (nextIdx < task.sequentialOrder.length) {
        task.currentSequentialIndex = nextIdx;
        const nextUserId = task.sequentialOrder[nextIdx];
        task.assigneeId = nextUserId;
        const nextUser = task.candidateUsers?.find(u => u.id === nextUserId || u.username === nextUserId);
        task.assignee = nextUser?.username || nextUserId;
        task.assigneeName = nextUser?.fullName || nextUser?.username || nextUserId;

        // Inactive check for the next user in sequence
        if (nextUser && nextUser.accountStatus && nextUser.accountStatus !== 'Active') {
          task.requiresSubstitute = true;
          task.substituteAlert = `کاربر نوبت بعدی «${task.assigneeName}» غیرفعال است و نیازمند تعیین جانشین می‌باشد.`;
        }

        instance.history.push({
          stepId: task.stepId,
          stepTitleFa: task.stepTitleFa,
          action: 'APPROVE',
          actor: actionData.actor || 'system_user',
          actorName: actionData.actorName || 'کاربر سیستم',
          comments: `تأیید شد و به نفر بعدی زنجیره («${task.assigneeName}») ارجاع گردید.`,
          timestamp: now
        });

        return {
          success: true,
          instance,
          task,
          completed: false,
          sequentialAdvance: true,
          nextApprover: task.assigneeName
        };
      }
    }

    // Step complete, advance to next workflow step
    task.status = 'COMPLETED';

    const nextIndex = instance.currentStepIndex + 1;
    if (nextIndex >= workflow.steps.length) {
      // Completed full lifecycle
      instance.state = 'COMPLETED';
      return { success: true, instance, task, completed: true, outcome: 'COMPLETED' };
    }

    // Advance to next step
    instance.currentStepIndex = nextIndex;
    const nextStep = workflow.steps[nextIndex];
    instance.currentStepId = nextStep.id;
    instance.currentStepTitleFa = nextStep.titleFa;
    instance.currentStepRole = nextStep.assignedRole;
    instance.dueDate = new Date(Date.now() + 1000 * 60 * 60 * nextStep.slaHours).toISOString();

    // Create next task
    const nextTask = buildTaskFromStep(nextStep, instance, now);
    DB.Tasks.set(nextTask.id, nextTask);

    return { success: true, instance, nextTask, completed: false };
  }

  return { success: true, instance, task };
}

export function substituteTaskApprover(
  taskId: string,
  substituteUserId: string,
  substituteUserName: string,
  reason: string = '',
  performedBy: string = 'system',
  performedByName: string = 'سیستم'
) {
  const task = DB.Tasks.get(taskId);
  if (!task) throw new Error("Task not found");

  const instance = DB.WorkflowInstances.get(task.instanceId);
  if (!instance) throw new Error("Instance not found");

  const origName = task.assigneeName || task.assignee || 'کاربر اولیه';
  const origId = task.assigneeId || '';

  task.assigneeId = substituteUserId;
  task.assignee = substituteUserName;
  task.assigneeName = substituteUserName;
  if (task.candidateUserIds) {
    task.candidateUserIds = task.candidateUserIds.map(id => id === origId ? substituteUserId : id);
  }
  task.requiresSubstitute = false;
  task.substituteAlert = undefined;
  task.substituteAssigned = {
    originalUserId: origId,
    originalUserName: origName,
    substituteUserId,
    substituteUserName,
    assignedAt: new Date().toISOString(),
    assignedBy: performedByName,
    reason
  };

  instance.history.push({
    stepId: task.stepId,
    stepTitleFa: task.stepTitleFa,
    action: 'SUBSTITUTE',
    actor: performedBy,
    actorName: performedByName,
    comments: `تعیین کاربر جایگزین: «${substituteUserName}» جانشین «${origName}» گردید. دلیل: ${reason || 'غیرفعال بودن یا مرخصی کاربر قبلی'}.`,
    timestamp: new Date().toISOString()
  });

  return { success: true, task, instance };
}

