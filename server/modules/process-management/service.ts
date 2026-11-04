let zbc: any = null;
let tasklist: any = null;
let initialized = false;

async function ensureCamundaClients() {
  if (initialized) return;
  initialized = true;
  if (!process.env.ZEEBE_ADDRESS && !process.env.CAMUNDA_CLUSTER_ID) {
    return;
  }
  try {
    const { Camunda8 } = await import('@camunda8/sdk');
    const c8 = new Camunda8();
    zbc = c8.getZeebeGrpcApiClient();
    tasklist = c8.getTasklistApiClient();
  } catch {
    // Running in internal customEngine mode
  }
}

export const camundaService = {
  deploy: async (xml: string, processName: string) => {
    await ensureCamundaClients();
    if (zbc) {
      return await zbc.deployResource({
        processDefinition: Buffer.from(xml),
        name: processName || 'process.bpmn'
      });
    }
    return { key: 'mock-deploy-key', deployments: [{ processDefinition: { bpmnProcessId: 'mock-process' } }] };
  },
  
  startInstance: async (bpmnProcessId: string, variables: any) => {
    await ensureCamundaClients();
    if (zbc) {
      return await zbc.createProcessInstance({
        bpmnProcessId,
        variables
      });
    }
    return { processInstanceKey: 'mock-instance-key', bpmnProcessId };
  },
  
  getTasks: async (assignee?: string, _group?: string) => {
    await ensureCamundaClients();
    if (tasklist) {
      const query: any = { state: 'CREATED' };
      if (assignee) query.assignee = assignee;
      return await tasklist.searchTasks(query);
    }
    return [
      { id: '1', name: 'تایید درخواست مرخصی', processName: 'درخواست مرخصی', creationTime: new Date().toISOString(), assignee: assignee || 'current_user' }
    ];
  },
  
  completeTask: async (taskId: string, variables: any) => {
    await ensureCamundaClients();
    if (tasklist) {
      return await tasklist.completeTask(taskId, variables);
    }
    return { success: true, taskId };
  }
};
