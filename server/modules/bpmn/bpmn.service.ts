import { desc, eq, sql } from 'drizzle-orm';
import { db, schema, withTransaction } from '../../core/db.ts';
import { auditService } from '../audit/audit.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { NotFoundError, ValidationError } from '../../core/errors.ts';
import { UserContext } from '../../core/middleware/auth.ts';

export interface BPMNProcess {
  id: number;
  processKey: string;
  name: string;
  category: string;
  priority: string;
  description: string;
  version: number;
  bpmnXml: string;
  status: 'draft' | 'deployed' | 'deprecated';
  createdAt: string;
  updatedAt: string;
}

export interface ProcessVersionItem {
  version: number;
  createdAt: string;
  createdBy: string;
  tag: string;
  changes: string;
  bpmnXml: string;
}

const DEFAULT_BPMN_PROCESSES: Array<{
  processKey: string;
  name: string;
  category: string;
  priority: string;
  description: string;
  bpmnXml: string;
  status: 'deployed' | 'draft';
}> = [
  {
    processKey: 'PTW_HOT_WORK',
    name: 'فرآیند صدور پروانه کار گرم (PTW Hot Work)',
    category: 'PTW',
    priority: 'بالا',
    description: 'گردش کار چندمرحله‌ای صدور مجوز کار گرم با تست گاز و تایید مدیر HSE',
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_PTW" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_PTW" isExecutable="true"><bpmn:startEvent id="StartEvent_1" name="ثبت درخواست PTW"/><bpmn:userTask id="Task_Area" name="تایید مسئول محوطه"/><bpmn:userTask id="Task_Safety" name="بررسی ایمنی و تست گاز"/><bpmn:userTask id="Task_HSEManager" name="تایید و امضای مدیر HSE"/><bpmn:endEvent id="EndEvent_1" name="صدور مجوز کار"/></bpmn:process></bpmn:definitions>`,
    status: 'deployed',
  },
  {
    processKey: 'INCIDENT_INVESTIGATION',
    name: 'گردش‌کار گزارش، ریشه‌یابی و مدیریت حوادث',
    category: 'Incident',
    priority: 'بحرانی',
    description: 'ثبت، بازرسی میدانی، تحلیل RCA و تدوین اقدامات اصلاحی CAPA',
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_INC"><bpmn:process id="Process_INC" isExecutable="true"><bpmn:startEvent id="Start_1" name="ثبت اولیه حادثه"/><bpmn:userTask id="Task_RCA" name="تشکیل تیم و تحلیل علل ریشه‌ای"/><bpmn:userTask id="Task_CAPA" name="تصویب اقدامات اصلاحی CAPA"/><bpmn:endEvent id="End_1" name="بستن پرونده حادثه"/></bpmn:process></bpmn:definitions>`,
    status: 'deployed',
  },
  {
    processKey: 'OCCUPATIONAL_HEALTH_CHECK',
    name: 'فرآیند معاینات ادواری و سلامت طب کار',
    category: 'Health',
    priority: 'متوسط',
    description: 'انجام آزمایشات، شنوایی‌سنجی، تنفس و تایید صلاحیت شغلی توسط پزشک',
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_MED"><bpmn:process id="Process_MED" isExecutable="true"><bpmn:startEvent id="Start_1" name="نوبت‌دهی معاینات"/><bpmn:userTask id="Task_Lab" name="ثبت نتایج پاراکلینیک"/><bpmn:userTask id="Task_Doc" name="نظریه نهایی و گواهی سلامت پزشک"/><bpmn:endEvent id="End_1" name="تکمیل پرونده سلامت"/></bpmn:process></bpmn:definitions>`,
    status: 'deployed',
  },
  {
    processKey: 'FIVE_S_INSPECTION',
    name: 'ممیزی دوره‌ای نظام آراستگی محیط کار (5S)',
    category: 'Inspection',
    priority: 'متوسط',
    description: 'بازرسی چک‌لیست پنج‌گانه، عکاسی قبل/بعد و ارزیابی انطباق واحد',
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_5S"><bpmn:process id="Process_5S" isExecutable="true"><bpmn:startEvent id="Start_1" name="شروع ممیزی 5S"/><bpmn:userTask id="Task_Audit" name="ثبت امتیازات و مشاهدات"/><bpmn:endEvent id="End_1" name="صدور کارنامه آراستگی"/></bpmn:process></bpmn:definitions>`,
    status: 'deployed',
  },
];

function mapRowToBPMNProcess(row: typeof schema.bpmnProcesses.$inferSelect): BPMNProcess {
  const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, any>;
  return {
    id: row.id,
    processKey: row.processKey,
    name: row.name,
    category: row.category || 'General',
    priority: meta.priority || 'متوسط',
    description: meta.description || '',
    version: row.version || 1,
    bpmnXml: row.xmlContent,
    status: (row.status as BPMNProcess['status']) || 'deployed',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export class BPMNService {
  private seededPromise: Promise<void> | null = null;

  private async ensureSeeded(): Promise<void> {
    if (!this.seededPromise) {
      this.seededPromise = (async () => {
        try {
          const existing = await db.select({ id: schema.bpmnProcesses.id }).from(schema.bpmnProcesses).limit(1);
          if (existing.length === 0) {
            for (const def of DEFAULT_BPMN_PROCESSES) {
              const nowIso = new Date().toISOString();
              await db
                .insert(schema.bpmnProcesses)
                .values({
                  processKey: def.processKey,
                  name: def.name,
                  category: def.category,
                  version: 1,
                  xmlContent: def.bpmnXml,
                  status: def.status,
                  metadata: {
                    priority: def.priority,
                    description: def.description,
                    versions: [
                      {
                        version: 1,
                        createdAt: nowIso,
                        createdBy: 'سیستم',
                        tag: 'نسخه اولیه',
                        changes: def.description,
                        bpmnXml: def.bpmnXml,
                      },
                    ],
                  },
                })
                .onConflictDoNothing({ target: schema.bpmnProcesses.processKey });
            }
          }
        } catch (err) {
          this.seededPromise = null;
          throw err;
        }
      })();
    }
    return this.seededPromise;
  }

  async getAllProcesses(): Promise<BPMNProcess[]> {
    await this.ensureSeeded();
    const rows = await db.select().from(schema.bpmnProcesses).orderBy(desc(schema.bpmnProcesses.updatedAt));
    return rows.map(mapRowToBPMNProcess);
  }

  async getProcessVersions(processId: number): Promise<ProcessVersionItem[]> {
    await this.ensureSeeded();
    const [row] = await db.select().from(schema.bpmnProcesses).where(eq(schema.bpmnProcesses.id, processId)).limit(1);
    if (!row) {
      throw new NotFoundError('فرآیند BPMN یافت نشد.');
    }
    const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, any>;
    const versions = Array.isArray(meta.versions) ? (meta.versions as ProcessVersionItem[]) : [];
    if (versions.length > 0) return versions;
    return [
      {
        version: row.version || 1,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        createdBy: 'سیستم',
        tag: `نسخه ${row.version || 1}`,
        changes: meta.description || 'استقرار نسخه پایه',
        bpmnXml: row.xmlContent,
      },
    ];
  }

  async deployProcess(
    data: {
      processId?: number;
      processKey?: string;
      name: string;
      category?: string;
      priority?: string;
      bpmnXml: string;
      versionTag?: string;
      changes?: string;
      user?: string;
    },
    userContext?: UserContext
  ) {
    await this.ensureSeeded();
    if (!data?.name?.trim() || !data?.bpmnXml?.trim()) {
      throw new ValidationError('نام فرآیند و محتوای BPMN XML الزامی است.');
    }

    const author = data.user || userContext?.name || userContext?.username || 'مدیر سیستم';

    const saved = await withTransaction(async (tx) => {
      let existing: typeof schema.bpmnProcesses.$inferSelect | undefined;
      if (data.processId) {
        const rows = await tx.select().from(schema.bpmnProcesses).where(eq(schema.bpmnProcesses.id, Number(data.processId))).limit(1);
        existing = rows[0];
      } else if (data.processKey) {
        const rows = await tx.select().from(schema.bpmnProcesses).where(eq(schema.bpmnProcesses.processKey, data.processKey)).limit(1);
        existing = rows[0];
      }

      const newVersionNum = existing ? (existing.version || 1) + 1 : 1;
      const prevMeta = (existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}) as Record<string, any>;
      const prevVersions: ProcessVersionItem[] = Array.isArray(prevMeta.versions) ? [...prevMeta.versions] : [];

      const newVersionItem: ProcessVersionItem = {
        version: newVersionNum,
        createdAt: new Date().toISOString(),
        createdBy: author,
        tag: data.versionTag || `نسخه ${newVersionNum}`,
        changes: data.changes || 'بروزرسانی نمودار فرآیند',
        bpmnXml: data.bpmnXml,
      };
      prevVersions.unshift(newVersionItem);

      const nextMeta = {
        ...prevMeta,
        priority: data.priority || prevMeta.priority || 'متوسط',
        description: data.changes || prevMeta.description || '',
        versions: prevVersions.slice(0, 50),
      };

      if (existing) {
        const [updated] = await tx
          .update(schema.bpmnProcesses)
          .set({
            name: data.name.trim(),
            category: data.category || existing.category,
            version: newVersionNum,
            xmlContent: data.bpmnXml,
            status: 'deployed',
            metadata: nextMeta,
            updatedAt: new Date(),
          })
          .where(eq(schema.bpmnProcesses.id, existing.id))
          .returning();
        return updated;
      }

      const processKey = data.processKey || `PROC_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const [inserted] = await tx
        .insert(schema.bpmnProcesses)
        .values({
          processKey,
          name: data.name.trim(),
          category: data.category || 'General',
          version: 1,
          xmlContent: data.bpmnXml,
          status: 'deployed',
          metadata: nextMeta,
        })
        .returning();
      return inserted;
    });

    await auditService.log({
      action: 'DEPLOY_BPMN_PROCESS',
      module: 'BPMN',
      entityType: 'BPMN_PROCESS',
      entityId: String(saved.id),
      newValue: { name: saved.name, version: saved.version },
      details: { author },
    });

    const dto = mapRowToBPMNProcess(saved);
    broadcastDataMutation('bpmn', 'deploy', dto, {
      module: 'BPMN',
      recordId: dto.id,
      actorId: userContext?.uid,
      version: dto.version,
    });

    return {
      success: true,
      processId: dto.id,
      version: dto.version,
      data: dto,
      message: `فرآیند "${dto.name}" با موفقیت در پایگاه داده مستقر گردید.`,
    };
  }

  async simulateProcess(data: { processId: number; scenario?: string; inputs?: any }) {
    await this.ensureSeeded();
    const [row] = await db.select().from(schema.bpmnProcesses).where(eq(schema.bpmnProcesses.id, Number(data.processId))).limit(1);
    const processName = row?.name || DEFAULT_BPMN_PROCESSES[0].name;
    const scenario = data.scenario || 'HAPPY_PATH';

    const steps = [
      { step: 1, name: 'رویداد آغازین (Start Event)', duration: '0.1s', status: 'COMPLETED' },
      { step: 2, name: 'تکمیل فرم درخواست اولیه توسط متقاضی', duration: '12m', status: 'COMPLETED' },
      {
        step: 3,
        name: 'ارزیابی مخاطرات محیطی و ایمنی',
        duration: '25m',
        status: scenario === 'REJECTION' ? 'REJECTED' : 'COMPLETED',
        note: scenario === 'REJECTION' ? 'عدم رعایت فاصله ایمنی با مخازن' : 'تایید ایمنی محوطه',
      },
      {
        step: 4,
        name: 'اندازه‌گیری گازهای اتمسفر (Gas Test)',
        duration: '15m',
        status: scenario === 'GAS_ALARM' ? 'FAILED' : 'COMPLETED',
        note: scenario === 'GAS_ALARM' ? 'LEL بالاتر از ۵ درصد ثبت شد' : 'محیط پاک و بدون گاز سمی',
      },
      { step: 5, name: 'صدور تاییدیه و امضای دیجیتال نهایی', duration: '5m', status: scenario === 'HAPPY_PATH' ? 'COMPLETED' : 'BLOCKED' },
    ];

    return {
      processId: data.processId,
      processName,
      scenario,
      simulationResult: scenario === 'HAPPY_PATH' ? 'SUCCESS' : 'EXCEPTION_HANDLED',
      simulatedDurationMinutes: 57,
      executionPath: steps,
      bottlenecksIdentified: [
        { task: 'تست گاز اتمسفر', avgWaitHours: 1.2, recommendation: 'استفاده از دتکتورهای آنلاین با سنسور وایرلس' },
      ],
    };
  }

  async getActiveInstances() {
    const rows = await db.select().from(schema.bpmnInstances).orderBy(desc(schema.bpmnInstances.startedAt));
    return rows.map((r) => ({
      instanceId: r.id,
      id: r.id,
      processId: r.processId,
      instanceNumber: r.instanceNumber,
      status: r.status.toLowerCase(),
      currentStep: r.currentNodeId,
      currentStepName: r.currentNodeName,
      initiatorId: r.initiatorId,
      variables: r.variables || {},
      assignee: (r.variables as any)?.assignee || null,
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    }));
  }

  async interveneInstance(
    instanceId: number,
    action: 'reassign' | 'retry' | 'skip' | 'terminate',
    params?: any,
    userContext?: UserContext
  ) {
    const [inst] = await db.select().from(schema.bpmnInstances).where(eq(schema.bpmnInstances.id, Number(instanceId))).limit(1);
    if (!inst) {
      throw new NotFoundError('نمونه فعال فرآیند یافت نشد.');
    }

    const vars = (inst.variables && typeof inst.variables === 'object' ? { ...(inst.variables as Record<string, any>) } : {}) as Record<string, any>;
    const updates: Partial<typeof schema.bpmnInstances.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (action === 'terminate') {
      updates.status = 'TERMINATED';
      updates.completedAt = new Date();
    } else if (action === 'reassign' && params?.assignee) {
      vars.assignee = params.assignee;
      updates.variables = vars;
    } else if (action === 'skip') {
      updates.currentNodeId = 'Next_Task';
      updates.currentNodeName = 'مرحله بعدی (مداخله دستی)';
    } else if (action === 'retry') {
      updates.status = 'RUNNING';
    }

    const [updated] = await db
      .update(schema.bpmnInstances)
      .set(updates)
      .where(eq(schema.bpmnInstances.id, inst.id))
      .returning();

    await auditService.log({
      action: `INTERVENE_INSTANCE_${action.toUpperCase()}`,
      module: 'BPMN',
      entityType: 'BPMN_INSTANCE',
      entityId: String(instanceId),
      details: { action, params, actor: userContext?.username },
    });

    broadcastDataMutation('bpmn', 'intervene', updated, {
      module: 'BPMN',
      recordId: updated.id,
      actorId: userContext?.uid,
    });

    return { success: true, instance: updated };
  }

  async getStatistics() {
    await this.ensureSeeded();
    const [processes, instances] = await Promise.all([
      db.select({ id: schema.bpmnProcesses.id }).from(schema.bpmnProcesses),
      db.select().from(schema.bpmnInstances),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const runningInstancesCount = instances.filter((i) => String(i.status).toUpperCase() === 'RUNNING' || String(i.status).toUpperCase() === 'ACTIVE').length;
    const completedInstances = instances.filter((i) => String(i.status).toUpperCase() === 'COMPLETED');
    const completedTodayCount = completedInstances.filter((i) => i.completedAt && new Date(i.completedAt) >= todayStart).length;

    let avgCompletionTimeHours = 0;
    if (completedInstances.length > 0) {
      const totalMs = completedInstances.reduce((sum, i) => {
        if (!i.completedAt || !i.startedAt) return sum;
        return sum + Math.max(0, new Date(i.completedAt).getTime() - new Date(i.startedAt).getTime());
      }, 0);
      avgCompletionTimeHours = Number((totalMs / completedInstances.length / 3600000).toFixed(1));
    }

    const monthlyMap = new Map<string, number>();
    for (const inst of instances) {
      const d = inst.startedAt ? new Date(inst.startedAt) : new Date();
      const label = d.toLocaleDateString('fa-IR', { month: 'long' });
      monthlyMap.set(label, (monthlyMap.get(label) || 0) + 1);
    }

    return {
      activeProcessesCount: processes.length,
      runningInstancesCount,
      completedTodayCount,
      avgCompletionTimeHours,
      monthlyDistribution: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })),
    };
  }

  async uploadBpmn(
    data: { name: string; bpmnXml: string; status?: 'active' | 'inactive'; owner?: string },
    userContext?: UserContext
  ) {
    await this.ensureSeeded();
    if (!data?.name?.trim() || !data?.bpmnXml?.trim()) {
      throw new ValidationError('نام فرآیند و محتوای BPMN XML الزامی است.');
    }

    const nowIso = new Date().toISOString();
    const processKey = `PROC_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const [inserted] = await db
      .insert(schema.bpmnProcesses)
      .values({
        processKey,
        name: data.name.trim(),
        category: 'General',
        version: 1,
        xmlContent: data.bpmnXml,
        status: data.status === 'inactive' ? 'draft' : 'deployed',
        metadata: {
          priority: 'متوسط',
          description: 'بارگذاری شده از طریق BPMN Modeler',
          owner: data.owner || userContext?.username || 'admin',
          versions: [
            {
              version: 1,
              createdAt: nowIso,
              createdBy: data.owner || userContext?.name || 'admin',
              tag: 'نسخه اولیه',
              changes: 'بارگذاری اولیه فایل BPMN',
              bpmnXml: data.bpmnXml,
            },
          ],
        },
      })
      .returning();

    const dto = mapRowToBPMNProcess(inserted);
    broadcastDataMutation('bpmn', 'create', dto, {
      module: 'BPMN',
      recordId: dto.id,
      actorId: userContext?.uid,
      version: dto.version,
    });
    return dto;
  }

  async getBpmnList() {
    const all = await this.getAllProcesses();
    return all.map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      createdAt: p.createdAt,
      status: p.status === 'deployed' ? 'active' : 'inactive',
      category: p.category,
    }));
  }

  async getBpmnById(id: number) {
    await this.ensureSeeded();
    const [row] = await db.select().from(schema.bpmnProcesses).where(eq(schema.bpmnProcesses.id, Number(id))).limit(1);
    if (!row) throw new NotFoundError('فایل فرآیند BPMN یافت نشد.');
    return mapRowToBPMNProcess(row);
  }

  async getBpmnXml(id: number) {
    const p = await this.getBpmnById(id);
    return p.bpmnXml;
  }

  async deleteBpmn(id: number, userContext?: UserContext) {
    await this.ensureSeeded();
    const deleted = await db
      .delete(schema.bpmnProcesses)
      .where(eq(schema.bpmnProcesses.id, Number(id)))
      .returning();
    if (deleted.length === 0) {
      throw new NotFoundError('فایل فرآیند BPMN جهت حذف یافت نشد.');
    }
    broadcastDataMutation('bpmn', 'delete', { id: Number(id) }, {
      module: 'BPMN',
      recordId: id,
      actorId: userContext?.uid,
    });
    return { success: true, message: 'فرآیند با موفقیت از پایگاه داده حذف شد.' };
  }
}

export const bpmnService = new BPMNService();
