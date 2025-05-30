# @wonderlandlabs/atmo-workers

Advanced worker management system with manifest-driven configuration, comprehensive request lifecycle tracking, intelligent load balancing, and multi-environment support.

## Features

🚀 **Manifest-Driven Configuration** - Define worker capabilities with structured manifests  
📊 **Complete Request Lifecycle Tracking** - Track every request from submission to completion  
⚖️ **Intelligent Load Balancing** - Automatic worker selection based on load and proficiency  
🔄 **Automatic Retry Logic** - Configurable retry policies with exponential backoff  
🌐 **Multi-Environment Support** - Works in browsers, Node.js, and testing environments  
🤖 **Mock Worker Support** - Built-in testing infrastructure  
📈 **Real-time Analytics** - Comprehensive metrics and monitoring  
🎯 **Type-Safe** - Full TypeScript support with detailed type definitions  

## Installation

```bash
npm install @wonderlandlabs/atmo-workers
```

## Quick Start

```typescript
import { createWorkerManager, COMPUTATION_WORKER_MANIFEST } from '@wonderlandlabs/atmo-workers';

// Create worker manager
const workerManager = createWorkerManager();

// Initialize a worker bank
await workerManager.initializeWorkerBank({
  bankId: 'computation-bank',
  manifest: COMPUTATION_WORKER_MANIFEST,
  workerCount: 4,
});

// Submit a request
const requestId = await workerManager.submitRequest('MATRIX_MULTIPLY', {
  matrixA: [[1, 2], [3, 4]],
  matrixB: [[5, 6], [7, 8]],
}, {
  clientId: 'my-app',
  priority: 8,
});

// Track request progress
const lifecycle = workerManager.getRequestLifecycle(requestId);
console.log('Request status:', lifecycle?.request.status);
```

## Core Concepts

### Worker Banks
Worker banks are groups of workers that share the same capabilities defined by a manifest:

```typescript
interface IInitWorkerBank {
  bankId: string;           // Unique identifier
  manifest: WorkerManifest; // Capabilities definition
  workerCount: number;      // Number of workers to create
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
    to: new Date() 
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

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.
