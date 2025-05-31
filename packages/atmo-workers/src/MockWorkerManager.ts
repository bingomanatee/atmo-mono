import type { WorkerManager } from './WorkerUtilities';

export class MockWorkerManager implements WorkerManager {
  private workers = new Map<string, any>();
  private listeners = new Map<
    any,
    Map<string, Set<(event: MessageEvent) => void>>
  >();

  createWorker(scriptUrl: string): any {
    const mockWorker = {
      scriptUrl,
      postMessage: (message: any) => {
        console.log(`🔧 Mock Worker (${scriptUrl}) received message:`, message);
        // Simulate async response
        setTimeout(() => {
          const listeners = this.listeners.get(mockWorker)?.get('message');
          if (listeners) {
            const responseEvent = new MessageEvent('message', {
              data: {
                type: 'completion-event',
                requestId: message.requestId,
                success: true,
                result: { mockResult: 'processed', originalMessage: message },
              },
            });
            listeners.forEach((listener) => listener(responseEvent));
          }
        }, 10);
      },
      terminate: () => {
        console.log(`🔧 Mock Worker (${scriptUrl}) terminated`);
        this.listeners.delete(mockWorker);
      },
    };

    this.workers.set(scriptUrl, mockWorker);
    this.listeners.set(mockWorker, new Map());
    console.log(`🔧 Mock Worker created for: ${scriptUrl}`);
    return mockWorker;
  }

  terminateWorker(worker: any): void {
    if (worker.terminate) {
      worker.terminate();
    }
  }

  postMessage(worker: any, message: any): void {
    if (worker.postMessage) {
      worker.postMessage(message);
    }
  }

  addEventListener(
    worker: any,
    type: string,
    listener: (event: MessageEvent) => void,
  ): void {
    const workerListeners = this.listeners.get(worker);
    if (workerListeners) {
      if (!workerListeners.has(type)) {
        workerListeners.set(type, new Set());
      }
      workerListeners.get(type)!.add(listener);
    }
  }

  removeEventListener(
    worker: any,
    type: string,
    listener: (event: MessageEvent) => void,
  ): void {
    const workerListeners = this.listeners.get(worker);
    if (workerListeners && workerListeners.has(type)) {
      workerListeners.get(type)!.delete(listener);
    }
  }
}
