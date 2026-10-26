import { Camunda8 } from '@camunda8/sdk';

let c8: Camunda8 | null = null;
let zbc: any = null;
let tasklist: any = null;

try {
  // Only attempt to initialize if some basic Camunda config is present
  if (process.env.ZEEBE_ADDRESS || process.env.CAMUNDA_CLUSTER_ID) {
    c8 = new Camunda8();
    zbc = c8.getZeebeGrpcApiClient();
    tasklist = c8.getTasklistApiClient();
  } else {
    console.log("Camunda 8 config not found. Running in mock mode.");
  }
} catch (e) {
  console.log("Camunda 8 configuration missing or invalid. Running in mock mode.");
}

export const camundaService = {
  deploy: async (xml: string, processName: string) => {
    if (zbc) {
      return await zbc.deployResource({
        processDefinition: Buffer.from(xml),
        name: processName || 'process.bpmn'
      });
    }
    return { key: 'mock-deploy-key', deployments: [{ processDefinition: { bpmnProcessId: 'mock-process' } }] };
  },
  
  startInstance: async (bpmnProcessId: string, variables: any) => {
    if (zbc) {
      return await zbc.createProcessInstance({
        bpmnProcessId,
        variables
      });
    }
    return { processInstanceKey: 'mock-instance-key', bpmnProcessId };
  },
  
  getTasks: async (assignee?: string, group?: string) => {
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
    if (tasklist) {
      return await tasklist.completeTask(taskId, variables);
    }
    return { success: true, taskId };
  }
};
