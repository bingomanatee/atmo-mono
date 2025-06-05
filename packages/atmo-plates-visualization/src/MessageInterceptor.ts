import { MESSAGE_TYPES, type MessageType } from './constants/messageTypes';

export interface MessagePattern {
  pattern: RegExp | string;
  type: MessageType;
  extractor?: (
    message: string,
    match?: RegExpMatchArray,
  ) => Record<string, any>;
}

export class MessageInterceptor {
  private patterns: MessagePattern[] = [];
  private listeners: Set<(message: any) => void> = new Set();
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    this.setupDefaultPatterns();
    this.interceptConsole();
    this.interceptWorkerMessages();
    this.interceptCustomEvents();
  }

  private setupDefaultPatterns(): void {
    // Platelet generation patterns
    this.addPattern({
      pattern: /Worker: Generated (\d+) platelets for plate (\w+)/,
      type: MESSAGE_TYPES.PLATELET.GENERATION_COMPLETE,
      extractor: (message, match) => ({
        plateletCount: parseInt(match![1]),
        plateId: match![2],
        timestamp: Date.now(),
      }),
    });

    // Process start patterns
    this.addPattern({
      pattern: /PlateletManager: Creating.*for plate (\w+)/,
      type: MESSAGE_TYPES.PROCESS.STARTED,
      extractor: (message, match) => ({
        processType: 'platelet-generation',
        plateId: match![1],
        processId: `platelet-gen-${match![1]}-${Date.now()}`,
        timestamp: Date.now(),
      }),
    });

    // Worker status patterns
    this.addPattern({
      pattern: /Worker.*ready/i,
      type: MESSAGE_TYPES.WORKER.READY,
      extractor: () => ({
        timestamp: Date.now(),
      }),
    });

    // Error patterns
    this.addPattern({
      pattern: /❌.*error/i,
      type: MESSAGE_TYPES.PROCESS.FAILED,
      extractor: (message) => ({
        error: message,
        timestamp: Date.now(),
      }),
    });

    // Progress patterns
    this.addPattern({
      pattern: /(\d+)% complete/i,
      type: MESSAGE_TYPES.MONITORING.PROGRESS_UPDATE,
      extractor: (message, match) => ({
        progress: parseInt(match![1]) / 100,
        timestamp: Date.now(),
      }),
    });

    // Database operation patterns
    this.addPattern({
      pattern: /Database.*(\d+) (\w+)/,
      type: MESSAGE_TYPES.MONITORING.DATABASE_OPERATION,
      extractor: (message, match) => ({
        count: parseInt(match![1]),
        operation: match![2],
        timestamp: Date.now(),
      }),
    });

    // Task queue patterns
    this.addPattern({
      pattern: /Task queued.*(\w+)/,
      type: MESSAGE_TYPES.TASK.QUEUED,
      extractor: (message, match) => ({
        taskId: match![1],
        timestamp: Date.now(),
      }),
    });

    // Simulation patterns
    this.addPattern({
      pattern: /Simulation.*initialized/i,
      type: 'simulation-initialized',
      extractor: () => ({
        timestamp: new Date(),
      }),
    });

    // Visualization patterns
    this.addPattern({
      pattern: /Visualizer.*created.*(\w+)/,
      type: 'visualizer-created',
      extractor: (message, match) => ({
        plateId: match![1],
        timestamp: new Date(),
      }),
    });
  }

  public addPattern(pattern: MessagePattern): void {
    this.patterns.push(pattern);
  }

  public addListener(listener: (message: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private interceptConsole(): void {
    const interceptMethod = (
      method: keyof typeof this.originalConsole,
      level: string,
    ) => {
      console[method] = (...args: any[]) => {
        // Call original method
        this.originalConsole[method].apply(console, args);

        // Process message
        const message = args
          .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
          .join(' ');

        this.processMessage(message, level);
      };
    };

    interceptMethod('log', 'info');
    interceptMethod('error', 'error');
    interceptMethod('warn', 'warning');
    interceptMethod('info', 'info');
  }

  private interceptWorkerMessages(): void {
    // Intercept worker postMessage
    if (typeof Worker !== 'undefined') {
      const originalPostMessage = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (
        message: any,
        transfer?: Transferable[],
      ) {
        // Forward to interceptor
        if (typeof message === 'object' && message.type) {
          setTimeout(() => {
            document.dispatchEvent(
              new CustomEvent('worker-message', {
                detail: { source: 'worker-outbound', message },
              }),
            );
          }, 0);
        }

        return originalPostMessage.call(this, message, transfer);
      };
    }

    // Listen for worker messages
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object') {
        this.processStructuredMessage(event.data, 'worker-inbound');
      }
    });
  }

  private interceptCustomEvents(): void {
    // Listen for custom atmo events
    document.addEventListener('atmo-state-update', (event: any) => {
      this.processStructuredMessage(event.detail, 'custom-event');
    });

    // Listen for worker message events
    document.addEventListener('worker-message', (event: any) => {
      this.processStructuredMessage(event.detail.message, event.detail.source);
    });
  }

  private processMessage(message: string, level: string): void {
    for (const patternConfig of this.patterns) {
      let match: RegExpMatchArray | null = null;
      let isMatch = false;

      if (patternConfig.pattern instanceof RegExp) {
        match = message.match(patternConfig.pattern);
        isMatch = match !== null;
      } else {
        isMatch = message.includes(patternConfig.pattern);
      }

      if (isMatch) {
        const extractedData = patternConfig.extractor
          ? patternConfig.extractor(message, match || undefined)
          : {};

        const processedMessage = {
          type: patternConfig.type,
          level,
          originalMessage: message,
          timestamp: new Date(),
          ...extractedData,
        };

        this.notifyListeners(processedMessage);
      }
    }
  }

  private processStructuredMessage(message: any, source: string): void {
    const processedMessage = {
      ...message,
      source,
      timestamp: message.timestamp || new Date(),
    };

    this.notifyListeners(processedMessage);
  }

  private notifyListeners(message: any): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        this.originalConsole.error('Error in message listener:', error);
      }
    });
  }

  public restore(): void {
    // Restore original console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
  }

  public getPatterns(): MessagePattern[] {
    return [...this.patterns];
  }

  public clearPatterns(): void {
    this.patterns = [];
  }

  // Utility method to manually dispatch a message
  public dispatchMessage(type: string, data: any): void {
    const message = {
      type,
      timestamp: new Date(),
      source: 'manual',
      ...data,
    };
    this.notifyListeners(message);
  }

  // Method to simulate common message types for testing
  public simulateMessages(): void {
    setTimeout(() => {
      this.dispatchMessage(MESSAGE_TYPES.SIMULATION.STARTED, {
        plateCount: 60,
      });
    }, 100);

    setTimeout(() => {
      this.dispatchMessage(MESSAGE_TYPES.PROCESS.STARTED, {
        processType: 'platelet-generation',
        plateId: 'plate-001',
        processId: 'proc-001',
      });
    }, 500);

    setTimeout(() => {
      this.dispatchMessage(MESSAGE_TYPES.MONITORING.PROGRESS_UPDATE, {
        processId: 'proc-001',
        progress: 0.5,
      });
    }, 1000);

    setTimeout(() => {
      this.dispatchMessage(MESSAGE_TYPES.PLATELET.GENERATION_COMPLETE, {
        plateId: 'plate-001',
        plateletCount: 1500,
      });
    }, 2000);
  }
}
