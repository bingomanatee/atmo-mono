// Example usage for test-math-worker
import { TaskManager, BrowserWorkerManager } from '@wonderlandlabs/atmo-workers';

// Create task manager
const taskManager = new TaskManager();

// Create worker manager with test-math-worker
const workerManager = new BrowserWorkerManager({
  manager: taskManager,
  configs: [
    {
      tasks: [
      "add",
      "subtract",
      "multiply",
      "divide",
      "power",
      "sqrt"
],
      script: './test-output/test-math-worker.js'
    }
  ]
});

// Example tasks for Mathematical operations worker

// Basic math operations
taskManager.addTask({
  name: 'add',
  params: { a: 10, b: 5 },
  onSuccess: (result) => console.log('10 + 5 =', result.content),
  onError: (error) => console.error('Math error:', error.error)
});

taskManager.addTask({
  name: 'divide',
  params: { a: 20, b: 4 },
  onSuccess: (result) => console.log('20 / 4 =', result.content)
});

taskManager.addTask({
  name: 'sqrt',
  params: { a: 16 },
  onSuccess: (result) => console.log('√16 =', result.content)
});

// Cleanup when done
function cleanup() {
  workerManager.close();
  taskManager.close();
}

// Optional: cleanup on page unload
window.addEventListener('beforeunload', cleanup);
