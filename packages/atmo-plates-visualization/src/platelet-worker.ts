// Platelet Worker for atmo-plates-visualization
// This worker generates platelets using the atmo-workers protocol

console.log('🚀 Platelet Worker: Starting initialization...');

// Import necessary modules for platelet generation
import {
  PlateletManager,
  PlateSimulation,
  COLLECTIONS,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { Multiverse } from '@wonderlandlabs/multiverse';

// Worker state
let workerMultiverse: Multiverse | null = null;
let plateletManager: PlateletManager | null = null;
let isInitialized = false;
let workerIdForLogging = 'unknown';

console.log('📦 Platelet Worker: Modules imported successfully');

// atmo-workers protocol handler
self.addEventListener('message', async (event) => {
  console.log(`📨 Platelet Worker: RAW MESSAGE RECEIVED:`, event.data);

  const { message, taskId, content, workerId, id } = event.data;

  // The worker ID might be in 'workerId' or 'id' field
  const actualWorkerId = workerId || id;

  console.log(`📨 Platelet Worker: Parsed message:`, {
    message,
    taskId,
    workerId,
    id,
    actualWorkerId,
    content: content ? Object.keys(content) : 'none',
    fullContent: content,
  });

  try {
    switch (message) {
      case 'init-worker':
        await handleInitWorker(actualWorkerId, content);
        break;

      case 'worker-work':
        await handleWorkerWork(taskId, content);
        break;

      default:
        console.log(`🤷 Platelet Worker: Unknown message type: ${message}`);
    }
  } catch (error) {
    console.error('❌ Platelet Worker: Error handling message:', error);
    self.postMessage({
      message: 'worker-response',
      taskId,
      workerId: actualWorkerId || 'platelet-worker',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Handle init worker signal
async function handleInitWorker(workerId: string | undefined, tasks: string[]) {
  // Store worker ID for logging - MUST use the workerId provided by BrowserTaskWorker
  workerIdForLogging =
    workerId || `worker-${Math.random().toString(36).substr(2, 9)}`;

  console.log(
    `🔧 Platelet Worker [${workerIdForLogging}]: Handling init-worker...`,
    {
      providedWorkerId: workerId,
      tasks,
      tasksType: typeof tasks,
      tasksLength: Array.isArray(tasks) ? tasks.length : 'not array',
    },
  );

  if (!workerId) {
    console.error(
      `❌ Platelet Worker: No workerId provided in init-worker message!`,
    );
    console.error(`   Available fields:`, Object.keys(arguments));
    return;
  }

  if (!isInitialized) {
    await initializeWorker();
  }

  // Send ready response with the EXACT workerId that was provided
  const readyMessage = {
    message: 'worker-ready',
    workerId: workerId, // Use the exact workerId from BrowserTaskWorker
    content: {
      tasks: ['generate-platelets'], // Tasks this worker can handle
    },
  };

  console.log(
    `📤 Platelet Worker [${workerIdForLogging}]: Sending worker-ready message:`,
    readyMessage,
  );

  console.log(
    `🚀 Platelet Worker [${workerIdForLogging}]: About to call self.postMessage...`,
  );
  self.postMessage(readyMessage);
  console.log(
    `✅ Platelet Worker [${workerIdForLogging}]: self.postMessage completed successfully`,
  );

  // Add a timeout to check if we receive any more messages
  setTimeout(() => {
    console.log(
      `⏰ Platelet Worker [${workerIdForLogging}]: 5 seconds after worker-ready - still waiting for work tasks...`,
    );
  }, 5000);
}

// Handle worker ready signal
async function handleWorkerReady() {
  console.log('🔧 Platelet Worker: Handling worker-ready...');

  if (!isInitialized) {
    await initializeWorker();
  }

  // Send ready response with supported tasks
  self.postMessage({
    message: 'worker-ready',
    workerId: 'platelet-worker',
    content: {
      tasks: ['generate-platelets'],
    },
  });
}

// Handle work assignment
async function handleWorkerWork(taskId: string, content: any) {
  console.log(`🔄 Platelet Worker: Starting task ${taskId}:`, content);

  if (content.name === 'generate-platelets') {
    try {
      const startTime = Date.now();
      const { plateId, planetRadius, resolution, universeId } = content.params;

      console.log(
        `🔧 Platelet Worker: Task ${taskId} - Generating platelets for plate ${plateId}`,
      );
      console.log(`🔧 Platelet Worker: Task ${taskId} - Parameters:`, {
        plateId,
        planetRadius,
        resolution,
        universeId,
      });

      if (!isInitialized) {
        console.error(
          `❌ Platelet Worker: Task ${taskId} - Worker not initialized!`,
        );
        throw new Error('Worker not initialized');
      }

      if (!plateletManager) {
        console.error(
          `❌ Platelet Worker: Task ${taskId} - PlateletManager not available!`,
        );
        throw new Error('PlateletManager not available');
      }

      console.log(
        `🚀 Platelet Worker: Task ${taskId} - Calling plateletManager.generatePlatelets(${plateId})`,
      );

      // Generate platelets using the worker's platelet manager
      const plateletCount = await plateletManager.generatePlatelets(plateId);

      console.log(
        `🎯 Platelet Worker: Task ${taskId} - generatePlatelets returned: ${plateletCount}`,
      );

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Platelet Worker: Generated ${plateletCount} platelets in ${executionTime}ms`,
      );

      // Send success response
      self.postMessage({
        message: 'worker-response',
        taskId,
        workerId: 'platelet-worker',
        content: {
          success: true,
          plateletCount,
          plateId,
          executionTime,
          message: `Generated ${plateletCount} platelets for plate ${plateId}`,
        },
      });
    } catch (error) {
      console.error(`❌ Platelet Worker: Error generating platelets:`, error);

      self.postMessage({
        message: 'worker-response',
        taskId,
        workerId: 'platelet-worker',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    console.log(`🤷 Platelet Worker: Unknown task: ${content.name}`);
    self.postMessage({
      message: 'worker-response',
      taskId,
      workerId: 'platelet-worker',
      error: `Unknown task: ${content.name}`,
    });
  }
}

// Initialize worker with shared database connection
async function initializeWorker() {
  try {
    console.log('🔧 Platelet Worker: Starting initialization...');

    // Create multiverse instance for worker
    console.log('🔧 Platelet Worker: Creating Multiverse instance...');
    workerMultiverse = new Multiverse();
    console.log('✅ Platelet Worker: Multiverse created successfully');

    // Connect to existing shared database (don't clear!)
    console.log('🔧 Platelet Worker: Adding universe "sim" to multiverse...');
    const universe = workerMultiverse.add({
      name: 'sim', // Connect to same universe as main thread
    });
    console.log('✅ Platelet Worker: Universe "sim" added successfully');

    // Create platelet manager that connects to shared database
    console.log('🔧 Platelet Worker: Creating PlateletManager...');
    plateletManager = new PlateletManager(universe);
    console.log('✅ Platelet Worker: PlateletManager created successfully');

    isInitialized = true;
    console.log(
      '✅ Platelet Worker: Initialization complete - worker ready for tasks',
    );
  } catch (error) {
    console.error('❌ Platelet Worker: Initialization failed:', error);
    console.error('❌ Platelet Worker: Error stack:', error.stack);
    throw error;
  }
}

// Add global error handlers
self.addEventListener('error', (event) => {
  console.error('❌ Platelet Worker: Unhandled error:', event.error);
  self.postMessage({
    message: 'worker-error',
    workerId: 'platelet-worker',
    error: event.error?.message || 'Unhandled error',
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error(
    '❌ Platelet Worker: Unhandled promise rejection:',
    event.reason,
  );
  self.postMessage({
    message: 'worker-error',
    workerId: 'platelet-worker',
    error: event.reason?.message || 'Unhandled promise rejection',
  });
});

console.log('✅ Platelet Worker: Ready for atmo-workers protocol');
