export function startWorkers() {
  if (!process.env.ZEEBE_ADDRESS && !process.env.CAMUNDA_CLUSTER_ID) {
    return;
  }

  void (async () => {
    try {
      const { Camunda8 } = await import('@camunda8/sdk');
      const c8 = new Camunda8();
      const zbc = c8.getZeebeGrpcApiClient();
      if (!zbc) return;

      zbc.createWorker({
        taskType: 'hse-service-task',
        taskHandler: async (job: any) => {
          console.log(`[Worker] Executing job ${job.key} with variables:`, job.variables);
          return job.complete({
            result: 'success',
            processedAt: new Date().toISOString()
          });
        }
      });
    } catch {
      // Ignored in internal engine mode
    }
  })();
}
