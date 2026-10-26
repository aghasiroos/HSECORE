import { desc, eq, and, sql } from 'drizzle-orm';
import { db, schema, withTransaction } from '../../core/db.ts';
import {
  WorkflowInstanceDTO,
  WorkflowStepDTO,
  WorkflowHistoryDTO,
  WorkflowSignatureDTO,
  WorkflowStatus,
  StepStatus,
} from './workflow.types.ts';
import { logger } from '../../core/logger.ts';

// In-memory backing store
const memInstances: WorkflowInstanceDTO[] = [];
const memSteps: WorkflowStepDTO[] = [];
const memHistory: WorkflowHistoryDTO[] = [];
const memSignatures: WorkflowSignatureDTO[] = [];

export class WorkflowRepository {
  async createInstanceWithSteps(data: {
    instance: Omit<WorkflowInstanceDTO, 'id' | 'steps' | 'history' | 'signatures' | 'startedAt' | 'updatedAt'>;
    steps: Array<Omit<WorkflowStepDTO, 'id' | 'instanceId' | 'createdAt'>>;
  }): Promise<WorkflowInstanceDTO> {
    const now = new Date().toISOString();
    const instanceId = memInstances.length + 1;

    const newInst: WorkflowInstanceDTO = {
      ...data.instance,
      id: instanceId,
      startedAt: now,
      updatedAt: now,
      steps: [],
      history: [],
      signatures: [],
    };

    const newSteps: WorkflowStepDTO[] = data.steps.map((s, idx) => ({
      ...s,
      id: memSteps.length + idx + 1,
      instanceId,
      createdAt: now,
    }));

    newInst.steps = newSteps;
    memInstances.unshift(newInst);
    memSteps.push(...newSteps);

    try {
      await withTransaction(async (tx) => {
        const [insertedInst] = await tx
          .insert(schema.workflowInstances)
          .values({
            workflowKey: data.instance.workflowKey,
            entityType: data.instance.entityType,
            entityId: data.instance.entityId,
            entityNumber: data.instance.entityNumber,
            title: data.instance.title,
            status: data.instance.status,
            currentStepOrder: data.instance.currentStepOrder,
            priority: data.instance.priority,
            requesterId: data.instance.requesterId,
            requesterName: data.instance.requesterName,
            requesterPersonnelCode: data.instance.requesterPersonnelCode,
            isLocked: data.instance.isLocked,
            version: data.instance.version,
            deadline: data.instance.deadline ? new Date(data.instance.deadline) : null,
            metadata: data.instance.metadata,
          })
          .returning();

        if (insertedInst) {
          newInst.id = insertedInst.id;
          for (const s of data.steps) {
            await tx.insert(schema.workflowSteps).values({
              instanceId: insertedInst.id,
              stepOrder: s.stepOrder,
              stepName: s.stepName,
              stepType: s.stepType,
              assignedRole: s.assignedRole,
              assignedDepartment: s.assignedDepartment,
              assignedUserId: s.assignedUserId,
              assignedPersonnelCode: s.assignedPersonnelCode,
              status: s.status,
              deadline: s.deadline ? new Date(s.deadline) : null,
              metadata: s.metadata,
            });
          }
        }
      });
    } catch (e) {
      logger.debug('Workflow instance saved to fallback memory store');
    }

    return newInst;
  }

  async findInstanceById(id: number): Promise<WorkflowInstanceDTO | null> {
    try {
      const [inst] = await db
        .select()
        .from(schema.workflowInstances)
        .where(eq(schema.workflowInstances.id, id));

      if (inst) {
        const steps = await db
          .select()
          .from(schema.workflowSteps)
          .where(eq(schema.workflowSteps.instanceId, id))
          .orderBy(schema.workflowSteps.stepOrder);

        const history = await db
          .select()
          .from(schema.workflowHistory)
          .where(eq(schema.workflowHistory.instanceId, id))
          .orderBy(desc(schema.workflowHistory.createdAt));

        const signatures = await db
          .select()
          .from(schema.workflowSignatures)
          .where(eq(schema.workflowSignatures.instanceId, id))
          .orderBy(schema.workflowSignatures.signedAt);

        return {
          id: inst.id,
          workflowKey: inst.workflowKey,
          entityType: inst.entityType,
          entityId: inst.entityId,
          entityNumber: inst.entityNumber || undefined,
          title: inst.title,
          status: inst.status as WorkflowStatus,
          currentStepOrder: inst.currentStepOrder,
          priority: inst.priority,
          requesterId: inst.requesterId || undefined,
          requesterName: inst.requesterName || undefined,
          requesterPersonnelCode: inst.requesterPersonnelCode || undefined,
          isLocked: inst.isLocked,
          version: inst.version,
          deadline: inst.deadline ? inst.deadline.toISOString() : undefined,
          metadata: inst.metadata,
          startedAt: inst.startedAt.toISOString(),
          completedAt: inst.completedAt ? inst.completedAt.toISOString() : undefined,
          updatedAt: inst.updatedAt.toISOString(),
          steps: steps.map((s) => ({
            id: s.id,
            instanceId: s.instanceId,
            stepOrder: s.stepOrder,
            stepName: s.stepName,
            stepType: s.stepType as any,
            assignedRole: s.assignedRole || undefined,
            assignedDepartment: s.assignedDepartment || undefined,
            assignedUserId: s.assignedUserId || undefined,
            assignedPersonnelCode: s.assignedPersonnelCode || undefined,
            status: s.status as StepStatus,
            deadline: s.deadline ? s.deadline.toISOString() : undefined,
            completedAt: s.completedAt ? s.completedAt.toISOString() : undefined,
            completedBy: s.completedBy || undefined,
            completedByRole: s.completedByRole || undefined,
            comment: s.comment || undefined,
            metadata: s.metadata,
            createdAt: s.createdAt.toISOString(),
          })),
          history: history.map((h) => ({
            id: h.id,
            instanceId: h.instanceId,
            stepId: h.stepId || undefined,
            action: h.action as any,
            actorName: h.actorName,
            actorRole: h.actorRole || undefined,
            actorDepartment: h.actorDepartment || undefined,
            actorPersonnelCode: h.actorPersonnelCode || undefined,
            comment: h.comment || undefined,
            signatureHash: h.signatureHash || undefined,
            ipAddress: h.ipAddress || undefined,
            createdAt: h.createdAt.toISOString(),
          })),
          signatures: signatures.map((sig) => ({
            id: sig.id,
            instanceId: sig.instanceId,
            stepId: sig.stepId || undefined,
            signerName: sig.signerName,
            signerRole: sig.signerRole,
            signerPersonnelCode: sig.signerPersonnelCode || undefined,
            signerDepartment: sig.signerDepartment || undefined,
            signatureType: sig.signatureType,
            signatureData: sig.signatureData || undefined,
            verificationCode: sig.verificationCode,
            signedAt: sig.signedAt.toISOString(),
            ipAddress: sig.ipAddress || undefined,
          })),
        };
      }
    } catch (e) {
      logger.debug('Reading workflow from fallback memory');
    }

    const mem = memInstances.find((i) => i.id === id);
    if (!mem) return null;
    return {
      ...mem,
      steps: memSteps.filter((s) => s.instanceId === id),
      history: memHistory.filter((h) => h.instanceId === id),
      signatures: memSignatures.filter((sig) => sig.instanceId === id),
    };
  }

  async findByEntity(entityType: string, entityId: string): Promise<WorkflowInstanceDTO | null> {
    try {
      const [inst] = await db
        .select()
        .from(schema.workflowInstances)
        .where(
          and(
            eq(schema.workflowInstances.entityType, entityType),
            eq(schema.workflowInstances.entityId, entityId)
          )
        )
        .orderBy(desc(schema.workflowInstances.id));

      if (inst) {
        return this.findInstanceById(inst.id);
      }
    } catch (e) {
      // Fallback
    }

    const mem = memInstances.find((i) => i.entityType === entityType && i.entityId === entityId);
    if (mem) {
      return this.findInstanceById(mem.id);
    }
    return null;
  }

  async updateInstanceStatus(
    id: number,
    updates: {
      status?: WorkflowStatus;
      currentStepOrder?: number;
      isLocked?: boolean;
      version?: number;
      completedAt?: string;
    }
  ): Promise<void> {
    const mem = memInstances.find((i) => i.id === id);
    if (mem) {
      if (updates.status) mem.status = updates.status;
      if (updates.currentStepOrder !== undefined) mem.currentStepOrder = updates.currentStepOrder;
      if (updates.isLocked !== undefined) mem.isLocked = updates.isLocked;
      if (updates.version !== undefined) mem.version = updates.version;
      if (updates.completedAt) mem.completedAt = updates.completedAt;
      mem.updatedAt = new Date().toISOString();
    }

    try {
      await db
        .update(schema.workflowInstances)
        .set({
          status: updates.status,
          currentStepOrder: updates.currentStepOrder,
          isLocked: updates.isLocked,
          version: updates.version,
          completedAt: updates.completedAt ? new Date(updates.completedAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.workflowInstances.id, id));
    } catch (e) {
      // Handled
    }
  }

  async updateStepStatus(
    stepId: number,
    updates: {
      status: StepStatus;
      completedBy?: string;
      completedByRole?: string;
      comment?: string;
      completedAt?: string;
    }
  ): Promise<void> {
    const mem = memSteps.find((s) => s.id === stepId);
    if (mem) {
      mem.status = updates.status;
      mem.completedBy = updates.completedBy;
      mem.completedByRole = updates.completedByRole;
      mem.comment = updates.comment;
      mem.completedAt = updates.completedAt;
    }

    try {
      await db
        .update(schema.workflowSteps)
        .set({
          status: updates.status,
          completedBy: updates.completedBy,
          completedByRole: updates.completedByRole,
          comment: updates.comment,
          completedAt: updates.completedAt ? new Date(updates.completedAt) : null,
        })
        .where(eq(schema.workflowSteps.id, stepId));
    } catch (e) {
      // Handled
    }
  }

  async addHistory(entry: Omit<WorkflowHistoryDTO, 'id' | 'createdAt'>): Promise<void> {
    const now = new Date().toISOString();
    memHistory.unshift({
      ...entry,
      id: memHistory.length + 1,
      createdAt: now,
    });

    try {
      await db.insert(schema.workflowHistory).values({
        instanceId: entry.instanceId,
        stepId: entry.stepId,
        action: entry.action,
        actorName: entry.actorName,
        actorRole: entry.actorRole,
        actorDepartment: entry.actorDepartment,
        actorPersonnelCode: entry.actorPersonnelCode,
        comment: entry.comment,
        signatureHash: entry.signatureHash,
        ipAddress: entry.ipAddress,
      });
    } catch (e) {
      // Handled
    }
  }

  async addSignature(entry: Omit<WorkflowSignatureDTO, 'id' | 'signedAt'>): Promise<void> {
    const now = new Date().toISOString();
    memSignatures.push({
      ...entry,
      id: memSignatures.length + 1,
      signedAt: now,
    });

    try {
      await db.insert(schema.workflowSignatures).values({
        instanceId: entry.instanceId,
        stepId: entry.stepId,
        signerName: entry.signerName,
        signerRole: entry.signerRole,
        signerPersonnelCode: entry.signerPersonnelCode,
        signerDepartment: entry.signerDepartment,
        signatureType: entry.signatureType,
        signatureData: entry.signatureData,
        verificationCode: entry.verificationCode,
        ipAddress: entry.ipAddress,
      });
    } catch (e) {
      // Handled
    }
  }

  async getAllInstances(): Promise<WorkflowInstanceDTO[]> {
    try {
      const records = await db
        .select()
        .from(schema.workflowInstances)
        .orderBy(desc(schema.workflowInstances.id))
        .limit(100);

      if (records.length > 0) {
        return records.map((r) => ({
          id: r.id,
          workflowKey: r.workflowKey,
          entityType: r.entityType,
          entityId: r.entityId,
          entityNumber: r.entityNumber || undefined,
          title: r.title,
          status: r.status as WorkflowStatus,
          currentStepOrder: r.currentStepOrder,
          priority: r.priority,
          isLocked: r.isLocked,
          version: r.version,
          startedAt: r.startedAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
      }
    } catch (e) {
      // Fallback
    }

    return [...memInstances];
  }
}

export const workflowRepository = new WorkflowRepository();
