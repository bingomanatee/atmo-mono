# Atmo Workers

A lightweight, event-driven worker management system that provides a clean
abstraction for managing Web Workers in browser environments. The system
implements a request-response pattern with automatic task distribution, worker
lifecycle management, and bidirectional messaging.

## Features

- **Event-driven architecture** using RxJS for reactive programming
- **Automatic task distribution** to available workers based on capabilities
- **Worker lifecycle management** with status tracking and health monitoring
- **Bidirectional messaging** between main thread and workers
- **Task queuing and prioritization** with status tracking

## Architecture Overview

The system consists of four main components working together:

1. **TaskManager** - Central coordinator for task lifecycle and event
   distribution
2. **BrowserWorkerManager** - Manages worker pool and task assignment logic
3. **BrowserTaskWorker** - Individual worker wrapper with messaging
   capabilities
4. **TaskRequest** - A request to perform a single unit of work

## Matching tasks and workers

Each task(TaskRequest) has a name; also each worker has an array of 1 or more
tasks its qualified to perform; this allows you to create "specialist workers"
with a limited set of tasks or "generalist workers" that can handle many different
task types.

## System Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                            MAIN THREAD                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    events$    ┌─────────────────────────────┐  │
│  │   TaskManager   │◄─────────────►│   BrowserWorkerManager      │  │
│  │                 │               │                             │  │
│  │ • Event coord   │               │ • Worker pool mgmt          │  │
│  │ • Task lifecycle│               │ • Task assignment           │  │
│  │ • Message route │               │ • Load balancing            │  │
│  └─────────────────┘               └─────────────────────────────┘  │
│           │                                        │                │
│           │ stores/updates                         │ manages        │
│           ▼                                        ▼                │
│  ┌─────────────────┐               ┌─────────────────────────────┐  │
│  │   Task Queue    │               │      Worker Wrappers        │  │
│  │                 │               │                             │  │
│  │ ┌─────────────┐ │               │ ┌─────────────────────────┐ │  │
│  │ │TaskRequest   │ │               │ │   BrowserTaskWorker 1   │ │  │
│  │ │status: NEW  │ │               │ │ • Message handling      │ │  │
│  │ └─────────────┘ │               │ │ • Status tracking       │ │  │
│  │ ┌─────────────┐ │               │ │ • Task execution        │ │  │
│  │ │TaskRequest   │ │               │ └─────────────────────────┘ │  │
│  │ │status: WORK │ │               │ ┌─────────────────────────┐ │  │
│  │ └─────────────┘ │               │ │   BrowserTaskWorker 2   │ │  │
│  │ ┌─────────────┐ │               │ │ • Message handling      │ │  │
│  │ │TaskRequest   │ │               │ │ • Status tracking       │ │  │
│  │ │status: DONE │ │               │ │ • Task execution        │ │  │
│  │ └─────────────┘ │               │ └─────────────────────────┘ │  │
│  └─────────────────┘               │           ...               │  │
│                                    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                        postMessage/ │ /onmessage
                           onmessage │ /postMessage
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                         WORKER THREADS                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   Web Worker 1  │  │   Web Worker 2  │  │   Web Worker N  │     │
│  │                 │  │                 │  │                 │     │
│  │ • Script exec   │  │ • Script exec   │  │ • Script exec   │     │
│  │ • Task process  │  │ • Task process  │  │ • Task process  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

Message Flow:
1. NEW_TASK: TaskManager → BrowserWorkerManager
2. TASK_AVAILABLE: BrowserWorkerManager → BrowserTaskWorker
3. TASK_CLAIM: BrowserTaskWorker → TaskManager
4. TASK_CLAIM_GRANTED: TaskManager → BrowserTaskWorker
5. WORKER_WORK: BrowserTaskWorker → Web Worker
6. WORKER_RESPONSE: Web Worker → BrowserTaskWorker → TaskManager
```

## Quick Start

### 1. Install the Package

```bash
npm install @wonderlandlabs/atmo-workers
```

### 2. Generate a Sample Worker (Optional)

Use the built-in CLI generator to quickly create sample workers:

```bash
# Generate a browser math worker
npm run generate-worker math-worker ./public/workers browser

# Generate a server data processing worker
npm run generate-worker data-processor ./workers server

# Generate a browser image processing worker (default)
npm run generate-worker image-worker
```

The generator creates:

- **Worker script** with proper error handling and self-identification
- **Usage example** showing how to integrate with your application
- **Multiple task types** based on the worker name (math, data, image)

**Worker Types:**

- **Math workers** (names containing 'math' or 'calc'): add, subtract, multiply,
  divide, power, sqrt
- **Data workers** (names containing 'data' or 'api'): fetch, transform,
  validate, filter
- **Image workers** (names containing 'image' or 'img'): resize, compress,
  filter, analyze

**Worker Types:**

- **Browser workers** (default): Use Web Workers for browser environments
- **Server workers**: Use Node.js Worker Threads for server-side multi-processing

### 3. Create a Worker Script

Create a worker script (e.g., `public/workers/math-worker.js`):

```javascript
// math-worker.js
let myWorkerId = null; // Store worker ID for self-identification

self.onmessage = function (e) {
  const { message, taskId, content, workerId } = e.data;

  switch (message) {
    case 'init-worker':
      // Worker initialization - record our ID for future messages
      myWorkerId = e.data.id;
      self.postMessage({
        message: 'worker-ready',
        workerId: myWorkerId,
        content: { tasks: e.data.content },
      });
      break;

    case 'worker-work':
      // Handle task execution
      const { name, params } = content;

      try {
        let result;

        switch (name) {
          case 'add':
            result = params.a + params.b;
            break;
          case 'multiply':
            result = params.a * params.b;
            break;
          case 'divide':
            if (params.b === 0) {
              throw new Error('Division by zero is not allowed');
            }
            result = params.a / params.b;
            break;
          case 'fibonacci':
            if (params.n < 0) {
              throw new Error('Fibonacci input must be non-negative');
            }
            result = fibonacci(params.n);
            break;
          default:
            throw new Error(`Unknown task: ${name}`);
        }

        // Send successful result
        self.postMessage({
          message: 'worker-response',
          taskId,
          workerId: myWorkerId,
          content: result,
        });
      } catch (error) {
        // Send error response
        self.postMessage({
          message: 'worker-response',
          taskId,
          workerId: myWorkerId,
          error: error.message,
        });
      }
      break;
  }
};

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

### 4. Set Up the Worker System

```typescript
import {
  TaskManager,
  BrowserWorkerManager,
} from '@wonderlandlabs/atmo-workers';

// Create task manager
const taskManager = new TaskManager();

// Create worker manager with worker configurations
const workerManager = new BrowserWorkerManager({
  manager: taskManager,
  configs: [
    {
      tasks: ['add', 'multiply', 'fibonacci'],
      script: '/workers/math-worker.js',
    },
    {
      tasks: ['fetch', 'transform', 'validate'],
      script: '/workers/data-worker.js',
    },
  ],
});

// Submit tasks
const mathTask = taskManager.addTask({
  name: 'fibonacci',
  params: { n: 40 },
  onSuccess: (result) => {
    console.log('Fibonacci result:', result.content);
  },
  onError: (error) => {
    console.error('Task failed:', error);
  },
});

const addTask = taskManager.addTask({
  name: 'add',
  params: { a: 10, b: 20 },
  onSuccess: (result) => {
    console.log('Addition result:', result.content);
  },
});
```

## Cleanup and Resource Management

All worker system components provide `close()` methods for proper cleanup of
subscriptions and resources. This is important to prevent memory leaks,
especially in single-page applications.

### Basic Cleanup

```typescript
// Clean up individual components
taskManager.close(); // Closes subscriptions and clears tasks
workerManager.close(); // Closes all workers and subscriptions

// Or clean up the entire system
workerManager.close(); // This will also close all individual workers
taskManager.close(); // Clean up the task manager
```

### Complete System Cleanup

```typescript
// Recommended cleanup order for complete system shutdown
function cleanupWorkerSystem() {
  // 1. Close worker manager (terminates all workers)
  workerManager.close();

  // 2. Close task manager (completes event streams)
  taskManager.close();

  console.log('Worker system cleaned up');
}

// Call cleanup when your application shuts down
window.addEventListener('beforeunload', cleanupWorkerSystem);
```

### What Gets Cleaned Up

- **TaskManager.close()**: Unsubscribes from internal events, completes the
  events$ stream, and clears all pending tasks
- **BrowserWorkerManager.close()**: Unsubscribes from task manager events,
  closes all managed workers, and clears worker references
- **BrowserTaskWorker.close()**: Unsubscribes from task manager events,
  terminates the underlying Web Worker, and sets status to OFFLINE

## Handling Results and Failures

The system provides robust error handling through success and failure callbacks
defined when creating tasks. Workers can return either successful results or
error messages, and the appropriate callback will be invoked.

### Success Handling

When a task completes successfully, the `onSuccess` callback receives the
complete response message:

```typescript
const task = taskManager.addTask({
  name: 'calculate',
  params: { operation: 'add', a: 5, b: 3 },
  onSuccess: (response) => {
    console.log('Task completed successfully!');
    console.log('Result:', response.content); // 8
    console.log('Task ID:', response.taskId);
    console.log('Worker ID:', response.workerId);
  },
});
```

### Error Handling

When a task fails, the `onError` callback receives the error response:

```typescript
const task = taskManager.addTask({
  name: 'divide',
  params: { a: 10, b: 0 }, // Division by zero
  onSuccess: (response) => {
    console.log('Result:', response.content);
  },
  onError: (response) => {
    console.error('Task failed!');
    console.error('Error:', response.error);
    console.error('Task ID:', response.taskId);
    console.error('Worker ID:', response.workerId);
  },
});
```

### Worker Error Reporting

Workers should return error messages using the `error` property:

```javascript
// In worker script
case 'divide':
  if (params.b === 0) {
    self.postMessage({
      message: 'worker-response',
      taskId,
      workerId: myWorkerId,
      error: 'Division by zero is not allowed'
    });
  } else {
    self.postMessage({
      message: 'worker-response',
      taskId,
      workerId: myWorkerId,
      content: params.a / params.b
    });
  }
  break;
```

### Task Status Updates

Failed tasks automatically update their status to `FAILED`, while successful
tasks update to `DONE` before being removed from the queue. You can monitor
task status using the TaskManager's `status()` method:

```typescript
const statusSummary = taskManager.status();
console.log('Failed tasks:', statusSummary.failed);
console.log('Working tasks:', statusSummary.working);
console.log('Pending tasks:', statusSummary.pending);
```

## Server Workers (Node.js)

For server-side applications, use `ServerWorkerManager` with Node.js Worker Threads
for true multi-processing across CPU cores.

### Server Worker Example

```javascript
const {
  TaskManager,
  ServerWorkerManager,
} = require('@wonderlandlabs/atmo-workers');
const path = require('path');
const os = require('os');

const taskManager = new TaskManager();

const workerManager = new ServerWorkerManager({
  manager: taskManager,
  configs: Array(os.cpus().length).fill({
    tasks: ['heavy-computation', 'data-processing'],
    script: path.join(__dirname, 'workers/server-worker.js'),
  }),
});

for (let i = 0; i < 100; i++) {
  taskManager.addTask({
    name: 'heavy-computation',
    params: { iterations: 10000000 },
    onSuccess: (result) => console.log(`Task ${i} completed`),
    onError: (error) => console.error(`Task ${i} failed:`, error.error),
  });
}
```

### Server vs Browser Workers

| Feature         | Browser Workers    | Server Workers           |
| --------------- | ------------------ | ------------------------ |
| **Environment** | Web browsers       | Node.js                  |
| **Technology**  | Web Workers        | Worker Threads           |
| **Isolation**   | Separate context   | Separate thread          |
| **CPU Cores**   | Limited by browser | Full multi-core support  |
| **Use Cases**   | UI responsiveness  | CPU-intensive processing |

## API Reference

### TaskManager

Central coordinator for task lifecycle and event distribution.

```typescript
class TaskManager {
  events$: Subject<MessageIF>; // Event stream for all messages
  id: string; // Unique manager identifier

  addTask(task: ITaskParams): TaskRequest; // Add new task to queue
  deleteTask(taskId: string): void; // Remove task from queue
  updateTask(taskId: string, props: Partial<TaskIF>): void; // Update task
  task(id: string): TaskIF | undefined; // Get task by ID
  status(): TaskStatusSummary; // Get current status summary
  emit(msg: MessageIF): void; // Emit message to event stream
  close(): void; // Clean up subscriptions and resources
}
```

**Key Methods:**

- `addTask()` - Creates a new task and adds it to the processing queue
- `status()` - Returns summary of tasks by status (pending, working, failed, etc.)
- `emit()` - Sends messages through the event system for worker coordination

### BrowserWorkerManager

Manages worker pool and handles task assignment logic.

```typescript
class BrowserWorkerManager {
  taskManager?: TaskManagerIF; // Reference to task manager
  workers: BrowserTaskWorker[]; // Array of managed workers

  constructor(props: { manager?: TaskManagerIF; configs: WorkerConfig[] });

  assignTaskManager(manager: TaskManagerIF): void; // Assign task manager
  onTask(task: TaskIF): void; // Handle new task assignment
  close(): void; // Close all workers and clean up subscriptions
}
```

**Key Features:**

- Automatically assigns tasks to capable workers based on task name
- Load balances across available workers using random selection
- Manages worker lifecycle and status updates

### BrowserTaskWorker

Individual worker wrapper that handles bidirectional messaging with Web Workers.

```typescript
class BrowserTaskWorker {
  id: string; // Unique worker identifier
  tasks: string[]; // Array of supported task names
  status: WorkerStatusValue; // Current worker status
  script: string; // Path to worker script

  constructor(
    browserWorkerManager: BrowserWorkerManagerIF,
    config: WorkerConfig,
  );

  claim(task: TaskIF): void; // Claim a task for execution
  listenToTaskManager(manager: TaskManagerIF): void; // Subscribe to events
  canDo(message: MessageIF): boolean; // Check if can handle task
  close(): void; // Terminate worker and clean up subscriptions
}
```

**Worker Statuses:**

- `OFFLINE` - Worker is initializing or unavailable
- `AVAILABLE` - Worker is ready to accept new tasks
- `WORKING` - Worker is actively processing a task
- `CLOSED` - Worker is permanently locked due to script failure

### TaskRequest

Task data structure with lifecycle management.

```typescript
class TaskRequest implements TaskIF {
  id: string; // Unique task identifier
  name: string; // Task type/name
  params: any; // Task parameters
  status: TaskStatusValue; // Current task status
  assignedWorker?: string; // ID of assigned worker
  onSuccess?: Function; // Success callback
  onError?: Function; // Error callback
}
```

**Task Statuses:**

- `NEW` - Task created but not yet assigned
- `WORKING` - Task assigned and being processed
- `DONE` - Task completed successfully
- `FAILED` - Task failed during execution
- `ACTIVE` - Task is active in the system

## Message Flow

The system uses a comprehensive message protocol for coordination:

1. **Task Submission**: `NEW_TASK` → TaskManager stores task
2. **Worker Discovery**: `WORKER_READY` → Manager finds available workers
3. **Task Assignment**: `TASK_AVAILABLE` → Workers can claim tasks
4. **Task Claiming**: `TASK_CLAIM` → Worker requests specific task
5. **Claim Approval**: `TASK_CLAIM_GRANTED` → Manager assigns task to worker
6. **Task Execution**: `WORKER_WORK` → Worker processes task
7. **Task Completion**: `WORKER_RESPONSE` → Results returned to manager

## Advanced Usage

For more detailed examples and advanced patterns, see:

- [Browser Usage Guide](./README.browser.md) - Complete browser integration
- [Node.js Usage Guide](./README.node.md) - Server-side worker patterns

## License

MIT
