import type { WorkerManager } from './WorkerUtilities';

export class BrowserWorkerManager implements WorkerManager {
  createWorker(scriptUrl: string): Worker {
    return new Worker(scriptUrl);
  }

  terminateWorker(worker: Worker): void {
    worker.terminate();
  }

  postMessage(worker: Worker, message: any): void {
    worker.postMessage(message);
  }

  addEventListener(
    worker: Worker,
    type: string,
    listener: (event: MessageEvent) => void,
  ): void {
    worker.addEventListener(type, listener);
  }

  removeEventListener(
    worker: Worker,
    type: string,
    listener: (event: MessageEvent) => void,
  ): void {
    worker.removeEventListener(type, listener);
  }
}
