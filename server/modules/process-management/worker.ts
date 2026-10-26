import { Camunda8 } from '@camunda8/sdk';

let c8: Camunda8 | null = null;
let zbc: any = null;

try {
  if (process.env.ZEEBE_ADDRESS || process.env.CAMUNDA_CLUSTER_ID) {
    c8 = new Camunda8();
    zbc = c8.getZeebeGrpcApiClient();
  }
} catch (e) {
  // Ignored in mock mode
}

export function startWorkers() {
  if (!zbc) return;

  zbc.createWorker({
    taskType: 'hse-service-task',
    taskHandler: async (job: any) => {
      console.log(`[Worker] Executing job ${job.key} with variables:`, job.variables);
      
      const success = true;
      
      if (success) {
        return job.complete({
          result: 'success',
          processedAt: new Date().toISOString()
        });
      } else {
        return job.fail('Service task failed', 3);
      }
    }
  });
  
  console.log('[Worker] Camunda 8 Job Workers started');
}
