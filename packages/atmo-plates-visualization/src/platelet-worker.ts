// Platelet Worker for atmo-plates-visualization
// This worker generates platelets using the atmo-workers protocol

console.log('🚀 Platelet Worker: Starting initialization...');

// Import necessary modules for platelet generation
import {
  PlateletManager,
  PlateSimulation,
  COLLECTIONS,
  simUniverse,
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
      tasks: [
        'generate-platelets',
        'populate-neighbors',
        'create-plate-edges',
        'generate-mesh-data',
      ], // Tasks this worker can handle
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

  // Determine task type from content - check multiple possible sources
  const taskType =
    content.taskType ||
    content.name ||
    (content.plateId && !content.taskType
      ? 'generate-platelets'
      : 'populate-neighbors');

  console.log(
    `🔍 Platelet Worker: Task ${taskId} - Detected task type: ${taskType}`,
  );
  console.log(`🔍 Platelet Worker: Task ${taskId} - Content analysis:`, {
    hasTaskType: !!content.taskType,
    hasName: !!content.name,
    hasPlateId: !!content.plateId,
    contentKeys: Object.keys(content),
  });

  if (taskType === 'generate-platelets') {
    try {
      const startTime = Date.now();
      const { plateId, plateData, planetRadius, resolution, universeId } =
        content;

      console.log(
        `🔧 Platelet Worker: Task ${taskId} - Generating platelets for plate ${plateId}`,
      );
      console.log(`🔧 Platelet Worker: Task ${taskId} - Parameters:`, {
        plateId,
        plateData,
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

      if (!plateData) {
        console.error(
          `❌ Platelet Worker: Task ${taskId} - No plate data provided!`,
        );
        throw new Error('No plate data provided');
      }

      console.log(
        `🚀 Platelet Worker: Task ${taskId} - Adding plate to worker universe:`,
        plateData,
      );

      // Add the plate to the worker's universe so generatePlatelets can find it
      const platesCollection = plateletManager.universe.get('plates');
      await platesCollection.add(plateData);

      console.log(
        `✅ Platelet Worker: Task ${taskId} - Plate added to worker universe, generating platelets...`,
      );

      // Generate platelets using the standard method (now that plate is in universe)
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
  } else if (taskType === 'create-plate-edges') {
    try {
      const startTime = Date.now();
      const { plateId, universeId } = content;

      console.log(
        `✂️ Platelet Worker: Task ${taskId} - Creating irregular edges for plate ${plateId}`,
      );

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
        `🚀 Platelet Worker: Task ${taskId} - Processing edges for plate ${plateId}`,
      );

      // Call the real edge creation method
      console.log(
        `✂️ Platelet Worker: Task ${taskId} - Calling plateletManager.createIrregularPlateEdges for plate ${plateId}`,
      );
      const edgeCount =
        await plateletManager.createIrregularPlateEdges(plateId);

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Platelet Worker: Created ${edgeCount} irregular edges in ${executionTime}ms`,
      );

      // Send success response
      self.postMessage({
        message: 'worker-response',
        taskId,
        workerId: workerIdForLogging,
        content: {
          success: true,
          edgeCount,
          plateId,
          executionTime,
          message: `Created ${edgeCount} irregular edges for plate ${plateId}`,
        },
      });
    } catch (error) {
      console.error(`❌ Platelet Worker: Error creating edges:`, error);

      self.postMessage({
        message: 'worker-response',
        taskId,
        workerId: workerIdForLogging,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else if (taskType === 'populate-neighbors') {
    try {
      const startTime = Date.now();
      const { plateId, universeId } = content;

      console.log(
        `🔗 Platelet Worker: Task ${taskId} - Populating neighbors for plate ${plateId}`,
      );

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
        `🚀 Platelet Worker: Task ${taskId} - Processing neighbors for plate ${plateId}`,
      );

      // TODO: Add neighbor population logic here
      // For now, simulate the work
      const neighborCount = await simulateNeighborPopulation(plateId);

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Platelet Worker: Populated ${neighborCount} neighbor relationships in ${executionTime}ms`,
      );

      // Send success response
      self.postMessage({
        message: 'worker-response',
        taskId,
        workerId: workerIdForLogging,
        content: {
          success: true,
          neighborCount,
          plateId,
          executionTime,
          message: `Populated ${neighborCount} neighbor relationships for plate ${plateId}`,
        },
      });
    } catch (error) {
      console.error(`❌ Platelet Worker: Error populating neighbors:`, error);

      self.postMessage({
        message: 'worker-response',
        taskId,
        workerId: workerIdForLogging,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    console.log(`🤷 Platelet Worker: Unknown task type: ${taskType}`);
    self.postMessage({
      message: 'worker-response',
      taskId,
      workerId: workerIdForLogging,
      error: `Unknown task type: ${taskType}`,
    });
  }
}

// Simulate neighbor population work (placeholder for actual implementation)
async function simulateNeighborPopulation(plateId: string): Promise<number> {
  // TODO: Implement actual neighbor population logic
  // For now, simulate some work and return a count
  await new Promise((resolve) =>
    setTimeout(resolve, 100 + Math.random() * 200),
  );
  return Math.floor(Math.random() * 50) + 10; // Return random neighbor count
}

// Simulate edge creation work (placeholder for actual implementation)
async function simulateEdgeCreation(plateId: string): Promise<number> {
  // TODO: Implement actual edge creation logic
  // For now, simulate some work and return a count
  await new Promise((resolve) =>
    setTimeout(resolve, 150 + Math.random() * 300),
  );
  return Math.floor(Math.random() * 100) + 20; // Return random edge count
}

// Initialize worker with shared database connection
async function initializeWorker() {
  try {
    console.log('🔧 Platelet Worker: Starting initialization...');

    // Create multiverse instance for worker
    console.log('🔧 Platelet Worker: Creating Multiverse instance...');
    workerMultiverse = new Multiverse();
    console.log('✅ Platelet Worker: Multiverse created successfully');

    // Create properly initialized universe using simUniverse function with multiverse
    console.log('🔧 Platelet Worker: Creating universe with simUniverse...');
    const universe = await simUniverse(workerMultiverse, {
      name: 'atmo-plates', // Connect to same database as main thread
      dontClear: true, // Don't clear existing data
    });
    console.log('✅ Platelet Worker: Universe initialized with simUniverse');

    // Create platelet manager with properly initialized universe
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
