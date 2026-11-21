import { Request, Response } from 'express';
import { camundaService } from './service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { isGlobalAdminUser, UserContext } from '../../core/middleware/auth.ts';
import { normalizeReferralText } from '../../routes/referral.router.ts';
import {
  DB,
  parseBPMN,
  startWorkflowInstance,
  processTaskAction,
  substituteTaskApprover,
  initializeWorkflows,
  runWithProcessState,
  WorkflowDefinition
} from './customEngine.ts';

function isUserAssignedToProcessTask(user: UserContext | undefined, task: any): boolean {
  if (!user || !task) return false;
  if (isGlobalAdminUser(user)) return true;

  const uId = String(user.uid || user.id || '').trim().toLowerCase();
  const uUsername = String(user.username || '').trim().toLowerCase();
  const uCode = String(user.personnelCode || '').trim().toLowerCase();
  const uName = normalizeReferralText(user.name);
  const uRole = normalizeReferralText(user.role);

  const tAssigneeId = String(task.assigneeId || '').trim().toLowerCase();
  const tAssignee = normalizeReferralText(task.assignee);
  const tRole = normalizeReferralText(task.assignedRole);

  if (tAssigneeId && (tAssigneeId === uId || tAssigneeId === uUsername || tAssigneeId === uCode)) {
    return true;
  }
  if (tAssignee && (tAssignee === uName || tAssignee === uUsername || tAssignee === uId)) {
    return true;
  }
  if (Array.isArray(task.candidateUserIds)) {
    const matchCandidateId = task.candidateUserIds.some((cid: string) => {
      const c = String(cid || '').trim().toLowerCase();
      return c && (c === uId || c === uUsername || c === uCode);
    });
    if (matchCandidateId) return true;
  }
  if (Array.isArray(task.candidateUsers)) {
    const matchCandidate = task.candidateUsers.some((cu: any) => {
      const cId = String(cu?.id || '').trim().toLowerCase();
      const cUser = String(cu?.username || '').trim().toLowerCase();
      const cName = normalizeReferralText(cu?.fullName || cu?.name);
      return (
        (cId && (cId === uId || cId === uUsername)) ||
        (cUser && (cUser === uUsername || cUser === uId)) ||
        (cName && uName && cName === uName)
      );
    });
    if (matchCandidate) return true;
  }
  // If no specific individual assignee is set on the task, check role match
  if (!tAssigneeId && !tAssignee && tRole && uRole && (tRole === uRole || uRole.includes(tRole) || tRole.includes(uRole))) {
    return true;
  }
  return false;
}

export const processController = {
  // Camunda 8 Deployment & Integration
  deploy: async (req: Request, res: Response) => {
    try {
      const { xml, processName } = req.body;
      const result = await camundaService.deploy(xml, processName);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Start instance (dual support: custom engine or Zeebe)
  startInstance: async (req: Request, res: Response) => {
    try {
      const { workflowId, bpmnProcessId, title, variables, initiatorInfo } = req.body;
      
      const targetWfId = workflowId || bpmnProcessId;
      if (!targetWfId) {
        return res.status(400).json({ success: false, message: 'Workflow ID is required' });
      }

      const customResult = await runWithProcessState('write', () => {
        if (!DB.Workflows.has(targetWfId)) return null;
        return startWorkflowInstance(targetWfId, title, variables, initiatorInfo);
      });

      if (customResult) {
        broadcastDataMutation('tasks', 'create', customResult);
        broadcastDataMutation('process_management', 'start', customResult);
        return res.json({ success: true, data: customResult });
      }

      // Fallback to Camunda 8 service if configured
      const result = await camundaService.startInstance(targetWfId, variables || {});
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get all tasks (with strict recipient-based filtering for non-admins)
  getTasks: async (req: Request, res: Response) => {
    try {
      const { status, moduleType, priority, assignedRole, userId, requiresSubstitute, department } = req.query;

      let taskList = await runWithProcessState('read', () => Array.from(DB.Tasks.values()));

      // Enforce server-side recipient isolation: only System Manager / Main Admin sees all tasks globally
      if (req.user && !isGlobalAdminUser(req.user)) {
        taskList = taskList.filter(t => isUserAssignedToProcessTask(req.user, t));
      }

      if (status && typeof status === 'string' && status !== 'all') {
        taskList = taskList.filter(t => t.status.toLowerCase() === status.toLowerCase());
      }
      if (moduleType && typeof moduleType === 'string' && moduleType !== 'all') {
        taskList = taskList.filter(t => t.moduleType === moduleType);
      }
      if (priority && typeof priority === 'string' && priority !== 'all') {
        taskList = taskList.filter(t => t.priority === priority);
      }
      if (assignedRole && typeof assignedRole === 'string' && assignedRole !== 'all') {
        taskList = taskList.filter(t => t.assignedRole === assignedRole);
      }
      if (department && typeof department === 'string' && department !== 'all') {
        taskList = taskList.filter(t => t.department === department || t.assignedDepartment === department);
      }
      if (requiresSubstitute === 'true') {
        taskList = taskList.filter(t => t.requiresSubstitute === true);
      }
      if (userId && typeof userId === 'string' && userId !== 'all') {
        taskList = taskList.filter(t => 
          t.assigneeId === userId || 
          t.assignee === userId || 
          (t.candidateUserIds && t.candidateUserIds.includes(userId)) ||
          (t.candidateUsers && t.candidateUsers.some(u => u.id === userId || u.username === userId))
        );
      }

      // Sort by creationTime desc
      taskList.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());

      res.json({ success: true, data: taskList });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Substitute approver for a task
  substituteApprover: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { substituteUserId, substituteUserName, reason, performedBy, performedByName } = req.body;

      if (!substituteUserId || !substituteUserName) {
        return res.status(400).json({ success: false, message: 'شناسه و نام کاربر جایگزین الزامی است' });
      }

      const result = await runWithProcessState('write', () =>
        substituteTaskApprover(
          id,
          substituteUserId,
          substituteUserName,
          reason,
          performedBy,
          performedByName
        )
      );

      broadcastDataMutation('tasks', 'substitute', result);
      broadcastDataMutation('process_management', 'substitute', result);

      res.json({ success: true, message: 'کاربر جایگزین با موفقیت تعیین گردید', data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Complete or action a task (strictly enforcing recipient authorization)
  completeTask: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { action = 'APPROVE', actor, actorName, comments, variables, delegateTo } = req.body;

      const customResult = await runWithProcessState('write', () => {
        if (!DB.Tasks.has(id)) return null;
        const targetTask = DB.Tasks.get(id)!;
        if (req.user && !isUserAssignedToProcessTask(req.user, targetTask)) {
          const forbiddenErr: any = new Error('شما مجاز به اقدام یا تأیید وظیفه ارجاع‌شده به شخص دیگر نیستید.');
          forbiddenErr.statusCode = 403;
          throw forbiddenErr;
        }
        return processTaskAction(id, action, {
          actor: actor || req.user?.username,
          actorName: actorName || req.user?.name,
          comments,
          delegateTo,
          variables
        });
      });

      if (customResult) {
        broadcastDataMutation('tasks', 'complete', customResult);
        broadcastDataMutation('process_management', 'action', customResult);
        return res.json({ success: true, data: customResult });
      }

      // Fallback to Camunda 8
      const result = await camundaService.completeTask(id, variables || {});
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({ success: false, message: error.message });
    }
  },

  // Process Instances
  getInstances: async (req: Request, res: Response) => {
    try {
      const { workflowId, state } = req.query;
      let instances = await runWithProcessState('read', () => Array.from(DB.WorkflowInstances.values()));

      if (workflowId && typeof workflowId === 'string' && workflowId !== 'all') {
        instances = instances.filter(i => i.workflowId === workflowId);
      }
      if (state && typeof state === 'string' && state !== 'all') {
        instances = instances.filter(i => i.state.toLowerCase() === state.toLowerCase());
      }

      instances.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      res.json({ success: true, data: instances });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getInstanceById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const found = await runWithProcessState('read', () => {
        const instance = DB.WorkflowInstances.get(id);
        if (!instance) return null;
        const workflow = DB.Workflows.get(instance.workflowId);
        return { instance, workflow };
      });
      if (!found) return res.status(404).json({ success: false, message: 'Instance not found' });
      res.json({ success: true, data: found });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Workflows Catalog
  getWorkflows: async (req: Request, res: Response) => {
    try {
      const { category, moduleType, search } = req.query;
      const snapshot = await runWithProcessState('read', () => ({
        list: Array.from(DB.Workflows.values()),
        instances: Array.from(DB.WorkflowInstances.values()),
      }));
      let list = snapshot.list;

      if (category && typeof category === 'string' && category !== 'all') {
        list = list.filter(w => w.category === category);
      }
      if (moduleType && typeof moduleType === 'string' && moduleType !== 'all') {
        list = list.filter(w => w.module_type === moduleType);
      }
      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        list = list.filter(w => 
          w.name.toLowerCase().includes(q) || 
          w.descriptionFa?.toLowerCase().includes(q) ||
          w.module_type.toLowerCase().includes(q)
        );
      }

      const instances = snapshot.instances;
      const enriched = list.map(wf => {
        const activeCount = instances.filter(i => i.workflowId === wf.id && i.state === 'ACTIVE').length;
        const totalCount = instances.filter(i => i.workflowId === wf.id).length;
        return {
          ...wf,
          activeInstancesCount: activeCount,
          totalInstancesCount: totalCount
        };
      });

      res.json({ success: true, data: enriched });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getWorkflow: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const found = await runWithProcessState('read', () => {
        const wf = DB.Workflows.get(id);
        if (!wf) return null;
        const instances = Array.from(DB.WorkflowInstances.values()).filter(i => i.workflowId === id);
        return { ...wf, instances };
      });
      if (!found) return res.status(404).json({ success: false, message: 'Workflow not found' });
      res.json({ success: true, data: found });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  deleteWorkflow: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await runWithProcessState('write', () => {
        if (!DB.Workflows.has(id)) return false;
        DB.Workflows.delete(id);
        return true;
      });
      if (!deleted) return res.status(404).json({ success: false, message: 'Workflow not found' });
      broadcastDataMutation('workflows', 'delete', { id });
      broadcastDataMutation('process_management', 'delete', { id });
      res.json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  saveWorkflow: async (req: Request, res: Response) => {
    try {
      const { id: reqId, xml, processName, moduleType, category, descriptionFa, slaHours, steps } = req.body;
      if (!xml || !processName || !moduleType) return res.status(400).json({ success: false, message: 'Missing parameters' });
      
      const id = reqId || `wf_custom_${Date.now()}`;
      
      // Validate XML
      parseBPMN(xml);

      const savedWf = await runWithProcessState('write', () => {
        const existing = DB.Workflows.get(id);
        const nextWf: WorkflowDefinition = {
          id,
          name: processName,
          module_type: moduleType,
          category: category || existing?.category || 'safety',
          descriptionFa: descriptionFa || existing?.descriptionFa || 'فرآیند سفارشی تعریف شده در سیستم',
          descriptionEn: existing?.descriptionEn || 'Custom Defined Workflow',
          version: existing ? existing.version + 1 : 1,
          is_active: true,
          slaHours: slaHours || existing?.slaHours || 24,
          roles: existing?.roles || ['HSE Officer', 'Manager'],
          steps: steps || existing?.steps || [
            { id: 's1', titleFa: 'ثبت و آغاز', titleEn: 'Initiation', assignedRole: 'Initiator', actionType: 'form', slaHours: 4 },
            { id: 's2', titleFa: 'بررسی و تایید', titleEn: 'Approval', assignedRole: 'HSE Manager', actionType: 'approval', slaHours: 8 }
          ],
          xml_data: xml,
          createdAt: existing ? existing.createdAt : new Date().toISOString()
        };
        DB.Workflows.set(id, nextWf);
        return nextWf;
      });
      broadcastDataMutation('workflows', 'save', savedWf);
      broadcastDataMutation('process_management', 'save', savedWf);
      
      res.json({ success: true, message: 'Workflow saved successfully', id, data: savedWf });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  resetWorkflows: async (_req: Request, res: Response) => {
    try {
      await initializeWorkflows(true);
      broadcastDataMutation('workflows', 'reset', {});
      res.json({ success: true, message: 'Workflows re-seeded successfully', count: DB.Workflows.size });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getStats: async (_req: Request, res: Response) => {
    try {
      const statsData = await runWithProcessState('read', () => {
        const totalWorkflows = DB.Workflows.size;
        const instances = Array.from(DB.WorkflowInstances.values());
        const tasks = Array.from(DB.Tasks.values());

        const activeInstances = instances.filter(i => i.state === 'ACTIVE').length;
        const completedInstances = instances.filter(i => i.state === 'COMPLETED').length;
        const rejectedInstances = instances.filter(i => i.state === 'REJECTED').length;

        const pendingTasks = tasks.filter(t => t.status === 'PENDING').length;
        const criticalTasks = tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length;

        const categories: Record<string, number> = {};
        DB.Workflows.forEach(wf => {
          categories[wf.category] = (categories[wf.category] || 0) + 1;
        });

        const totalResolved = completedInstances + rejectedInstances;
        const slaCompliance = totalResolved > 0 ? Number(((completedInstances / totalResolved) * 100).toFixed(1)) : 100;

        return {
          totalWorkflows,
          activeInstances,
          completedInstances,
          rejectedInstances,
          pendingTasks,
          criticalTasks,
          slaCompliance,
          categories
        };
      });

      res.json({
        success: true,
        data: statsData
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

