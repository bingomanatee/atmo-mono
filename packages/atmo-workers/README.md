# Atmo Workers - Minimal POC

A lightweight, minimal proof-of-concept worker management system implementing a clean MVC pattern for request-response processing.

## 🏗️ System Architecture

### Overview

This POC demonstrates a simple yet effective worker management system that can process requests asynchronously using a clean separation of concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                    Atmo Workers POC                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Client    │───▶│ RequestMgr  │───▶│   Storage   │     │
│  │ (Controller)│    │   (Model)   │    │   (Maps)    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │ Data Models │    │ Test Mode   │                        │
│  │   (View)    │    │ Processor   │                        │
│  └─────────────┘    └─────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **RequestManager (Model)**

- **Purpose**: Core business logic and request lifecycle management
- **Responsibilities**:
  - Accept and queue requests
  - Process requests using configurable reducers
  - Manage request state transitions
  - Provide system metrics
- **Storage**: Simple in-memory Maps for POC simplicity

#### 2. **Data Models (View Contracts)**

- **Purpose**: Define clean interfaces and data structures
- **Key Models**:
  - `Request`: Core request entity with embedded results
  - `Bank`: Worker pool representation
  - `Task`: Task definition
  - `SystemMetrics`: System health and performance data

#### 3. **Client Interface (Controller)**

- **Purpose**: Simple API for external interaction
- **Methods**:
  - `submitRequest()`: Submit new requests
  - `getRequest()`: Query request status
  - `getResult()`: Retrieve request results
  - `getSystemMetrics()`: System health data

## 🎯 Design Principles

### 1. **Minimal Viable Product**

- Only essential features for POC validation
- No over-engineering or premature optimization
- Clean, readable code over complex abstractions

### 2. **Single Responsibility**

- Each component has one clear purpose
- Request processing separated from storage
- Business logic isolated from data models

### 3. **Mutation Over Creation**

- Direct field updates instead of object recreation
- Efficient memory usage
- Simpler state management

### 4. **Test-First Design**

- Built with testing in mind
- Test mode with configurable request reducers
- Easy to mock and validate

## 📊 Data Flow

```
1. Client submits request
   ↓
2. RequestManager creates Request object
   ↓
3. Request stored in Map with 'pending' status
   ↓
4. In test mode: immediate processing
   ↓
5. Request status mutated to 'processing'
   ↓
6. RequestReducer processes parameters
   ↓
7. Request mutated with result/error
   ↓
8. Request status mutated to 'completed'/'failed'
   ↓
9. Client queries result via getResult()
```

## 🚀 Usage Example

```typescript
import { RequestManager } from '@wonderlandlabs/atmo-workers';

// Create manager with test mode
const manager = new RequestManager({
  name: 'math-processor',
  testMode: true,
  requestReducer: (taskId, params) => {
    if (taskId === 'add-numbers') {
      return { result: params.a + params.b };
    }
    throw new Error(`Unknown task: ${taskId}`);
  },
});

// Register a bank and task
await manager.registerBank({
  bankId: 'math-bank',
  name: 'Math Operations',
  status: 'active',
});

await manager.registerTask({
  taskId: 'add-numbers',
  name: 'Add Two Numbers',
});

// Submit request
const requestId = await manager.submitRequest(
  'add-numbers',
  { a: 5, b: 3 },
  { clientId: 'client-1' },
);

// Wait for processing
await new Promise((resolve) => setTimeout(resolve, 50));

// Get result
const result = await manager.getResult(requestId);
console.log(result.payload); // { result: 8 }
```

## Core Concepts

### Worker Banks

Worker banks are groups of workers that share the same capabilities defined by a manifest:

```typescript
interface IInitWorkerBank {
  bankId: string; // Unique identifier
  manifest: WorkerManifest; // Capabilities definition
  workerCount: number; // Number of workers to create
  config?: Record<string, any>; // Runtime configuration
}
```

### Request Lifecycle

Every request goes through a complete tracked lifecycle:

1. **Pending** - Request submitted, waiting for assignment
2. **Assigned** - Assigned to a worker bank
3. **Processing** - Being processed by a worker
4. **Completed** - Successfully completed
5. **Failed** - Failed (with retry logic if applicable)

### Manifests

Manifests define what actions workers can perform:

```typescript
interface WorkerManifest {
  name: string;
  version: string;
  browserWorkerPath: string;
  nodeWorkerPath: string;
  actions: WorkerActionDefinition[];
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
}
```

## Built-in Manifests

The package includes several pre-built manifests:

- **Computation** - Mathematical and scientific computing
- **Data Processing** - ETL, analysis, and transformation
- **AI Inference** - Machine learning and AI operations
- **Image Processing** - Image manipulation and analysis
- **Geospatial** - Geographic and spatial operations
- **Crypto** - Cryptographic operations

## Advanced Usage

### Custom Manifests

```typescript
const customManifest: WorkerManifest = {
  name: 'custom-processor',
  version: '1.0.0',
  browserWorkerPath: '/workers/custom-worker.js',
  nodeWorkerPath: './workers/custom-worker-node.js',
  actions: [
    {
      actionId: 'PROCESS_DATA',
      description: 'Process custom data',
      retryable: true,
      estimatedDuration: 2000,
      responseType: 'ProcessResult',
      parameters: [
        {
          name: 'data',
          type: 'object',
          required: true,
          description: 'Data to process',
        },
      ],
    },
  ],
};
```

### Request Querying

```typescript
// Query requests with filters
const requests = workerManager.queryRequests({
  status: ['pending', 'processing'],
  priorityRange: { min: 7, max: 10 },
  dateRange: {
    from: new Date('2024-01-01'),
    to: new Date(),
  },
  pagination: {
    offset: 0,
    limit: 50,
    sortBy: 'priority',
    sortOrder: 'desc',
  },
});
```

### System Metrics

```typescript
const metrics = workerManager.getSystemMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successRate: metrics.successRate,
  averageProcessingTime: metrics.averageProcessingTime,
  currentLoad: metrics.currentLoad,
});
```

### Event Handling

```typescript
workerManager.on('request-submitted', ({ requestId, request }) => {
  console.log(`New request: ${requestId}`);
});

workerManager.on('request-completed', ({ requestId, result }) => {
  console.log(`Request completed: ${requestId}`);
});

workerManager.on('request-failed', ({ requestId, error }) => {
  console.error(`Request failed: ${requestId}`, error);
});
```

## Environment Support

### Browser

Uses Web Workers with full IndexedDB support for persistence.

### Node.js

Falls back to main thread processing or uses Worker Threads when available.

### Testing

Automatically uses mock workers for consistent test results.

```typescript
import { EnvironmentSniffer } from '@wonderlandlabs/atmo-workers';

const capabilities = EnvironmentSniffer.getCapabilities();
console.log({
  environment: capabilities.environment,
  webWorkers: capabilities.webWorkers,
  nodeWorkers: capabilities.nodeWorkers,
  concurrency: capabilities.concurrency,
});
```

## API Reference

### WorkerManager

Main class for managing worker banks and requests.

#### Methods

- `initializeWorkerBank(config)` - Initialize a worker bank
- `submitRequest(taskId, parameters, options)` - Submit a new request
- `getRequestLifecycle(requestId)` - Get complete request information
- `queryRequests(query)` - Query requests with filters
- `getSystemMetrics()` - Get system performance metrics
- `shutdown()` - Gracefully shutdown all workers

### RequestManager

Handles the complete lifecycle of requests.

#### Methods

- `registerBank(bank)` - Register a worker bank
- `registerTask(task)` - Register a task definition
- `registerCapability(capability)` - Register bank capability
- `submitRequest(taskId, parameters, options)` - Submit request
- `getSystemMetrics()` - Get comprehensive metrics

### ActivityTracer

Tracks worker activity and provides load balancing recommendations.

#### Methods

- `initializeBank(bankId, workerIds)` - Initialize tracking for a bank
- `getNextWorker(bankId?)` - Get recommended worker for next task
- `getLoadBalancingReport()` - Get load balancing analysis

## Platform-Specific Documentation

Atmo Workers provides different approaches optimized for different environments:

| Environment | Approach                             | Use Cases                                                         | Documentation                                 |
| ----------- | ------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------- |
| **Browser** | Web Workers with `BrowserWorker`     | Client-side multiprocessing, image processing, heavy calculations | **[📖 Browser Guide →](./README.browser.md)** |
| **Node.js** | Task handlers with `WorkerResponder` | Server APIs, background jobs, microservices                       | **[📖 Node.js Guide →](./README.node.md)**    |

### 🌐 Browser Workers

For detailed browser-specific documentation including Web Workers, client-side multiprocessing, and worker script examples:

**[📖 Browser Workers Guide →](./README.browser.md)**

Key features:

- True multiprocessing with Web Workers
- Automatic load balancing across workers
- Worker script templates for common tasks
- Real-time worker status monitoring

### 🖥️ Node.js Workers

For server-side task processing, Express.js integration, background jobs, and production deployment:

**[📖 Node.js Workers Guide →](./README.node.md)**

Key features:

- Injectable utilities for databases, HTTP, file system
- Express.js and microservice integration
- Background job processing with cron
- Production-ready error handling and monitoring

## Browser Web Workers (Client-side Multiprocessing)

The `BrowserWorker` class provides specialized support for managing multiple web workers in browser environments, enabling true client-side multiprocessing.

### Quick Start

```typescript
import { createBrowserWorkerManager } from '@wonderlandlabs/atmo-workers';

// Create a browser worker manager with multiple web workers
const { taskManager, browserWorker } = createBrowserWorkerManager({
  name: 'my-browser-app',
  window: window, // Inject the browser window
  workerManifests: [
    {
      name: 'math-worker',
      scriptUrl: '/workers/math-worker.js',
      tasks: ['add', 'multiply', 'calculate'],
    },
    {
      name: 'data-worker',
      scriptUrl: '/workers/data-worker.js',
      tasks: ['fetch', 'transform', 'validate'],
    },
    {
      name: 'image-worker',
      scriptUrl: '/workers/image-worker.js',
      tasks: ['resize', 'filter', 'compress'],
    },
  ],
  maxConcurrentTasks: 4,
  workerTimeout: 30000, // 30 seconds
});

// Submit tasks that will be distributed across workers
const mathResult$ = taskManager.submitRequest(
  'add',
  { a: 5, b: 3 },
  { clientId: 'math-client' },
);

const dataResult$ = taskManager.submitRequest(
  'fetch',
  { url: 'https://api.example.com/data' },
  { clientId: 'data-client' },
);

// All tasks run concurrently on different workers
Promise.all([mathResult$.toPromise(), dataResult$.toPromise()]).then(
  (results) => {
    console.log('All tasks completed:', results);
  },
);

// Monitor worker status
console.log('Worker status:', browserWorker.getWorkerStatus());

// Clean up when done
browserWorker.terminate();
```

### Worker Script Template

Create worker scripts using the provided template (`worker-template.js`):

```javascript
// /workers/math-worker.js
const taskHandlers = {
  add: (parameters) => {
    const { a, b } = parameters;
    return { result: a + b, operation: 'addition' };
  },

  multiply: (parameters) => {
    const { a, b } = parameters;
    return { result: a * b, operation: 'multiplication' };
  },

  calculate: (parameters) => {
    const { expression } = parameters;
    // Use a proper expression parser in production
    const result = eval(expression);
    return { result, expression };
  },
};

// Worker message handler
self.addEventListener('message', async (event) => {
  const { type, taskId, parameters, requestId, timestamp } = event.data;

  if (type === 'execute-task') {
    try {
      const handler = taskHandlers[taskId];
      if (!handler) {
        throw new Error(`Unknown task: ${taskId}`);
      }

      const result = await handler(parameters);

      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: true,
        result,
        executionTime: Date.now() - timestamp,
      });
    } catch (error) {
      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: false,
        error: error.message,
        executionTime: Date.now() - timestamp,
      });
    }
  }
});
```

### Features

- **Automatic Load Balancing**: Tasks are automatically distributed to available workers
- **Concurrent Processing**: Multiple tasks can run simultaneously on different workers
- **Worker Status Monitoring**: Real-time status of all workers
- **Timeout Handling**: Configurable timeouts for worker responses
- **Error Recovery**: Automatic cleanup and error handling
- **Task Routing**: Tasks are routed to appropriate workers based on manifests

### Worker Manifests

Worker manifests define which tasks each worker can handle:

```typescript
interface WorkerManifest {
  name: string; // Human-readable worker name
  scriptUrl: string; // Path to the worker script
  tasks: string[]; // Array of task names this worker can handle
}
```

### Monitoring and Management

```typescript
// Get detailed worker status
const status = browserWorker.getWorkerStatus();
status.forEach((worker) => {
  console.log(`Worker: ${worker.name}`);
  console.log(`  Busy: ${worker.busy}`);
  console.log(`  Tasks completed: ${worker.tasksCompleted}`);
  console.log(`  Current task: ${worker.currentTask || 'none'}`);
  console.log(`  Handles: ${worker.tasks.join(', ')}`);
});

// Terminate all workers when done
browserWorker.terminate();
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.
