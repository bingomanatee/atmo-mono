type PlateletWorkerOptions = WorkerOptions & { plateletManager: PlateletManagerIF };

export class PlateletWorker extends Worker {
  constructor(scriptURL: string | URL, params: PlateletWorkerOptions) {
    const { plateletManager, ...options } = params;
    try {
      super(scriptURL, { ...options, type: 'module' });
    } catch (error) {
      super(scriptURL, options);
    }

    this.addEventListener('message', (event) => {

      if (event.data.type === 'worker-ready') {
        plateletManager.workersReady++;

        if (
          plateletManager.workersReady >=
          plateletManager.expectedWorkers
        ) {
          plateletManager.workerAvailable = true;
        } else {
        }
      }

      if (event.data.type === 'worker-error') {
        plateletManager.workerAvailable = false;

        const workerError = new Error(
          `Worker initialization failed: ${event.data.error}`
        );
        if (event.data.stack) {
          workerError.stack = event.data.stack;
        }

      }

      if (event.data.type === 'task-progress') {
      }

      if (event.data.type === 'worker-task-error') {
      }

      if (event.data.type === 'worker-unhandled-error') {
      }

      if (event.data.type === 'worker-unhandled-rejection') {
      }
    });

    this.addEventListener('error', (error) => {
    });

    this.addEventListener('messageerror', (error) => {
    });

  }
}
