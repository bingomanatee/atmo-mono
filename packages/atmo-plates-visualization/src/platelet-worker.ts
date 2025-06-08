// Platelet Worker Bridge for atmo-plates-visualization
// This worker script integrates the platelet worker with atmo-workers protocol

console.log('🚀 Platelet Worker: Script starting to load...');

// Note: Worker functionality has been removed from atmo-plates core
// This worker file is now a placeholder for future worker implementation
console.log(
  '📦 Platelet Worker: Worker functionality will be implemented in visualization layer',
);

// Track all messages for debugging
let messageCount = 0;

// atmo-workers protocol handler
self.addEventListener('message', async (event) => {
  messageCount++;
  console.log(`📨 Platelet Worker: Received message #${messageCount}:`, {
    type: event.data.type,
    taskId: event.data.taskId,
    requestId: event.data.requestId,
    timestamp: event.data.timestamp,
    fullData: event.data,
  });

  // Send immediate acknowledgment that we received the message
  if (event.data.type === 'execute-task') {
    self.postMessage({
      type: 'task-progress',
      taskId: event.data.taskId,
      requestId: event.data.requestId,
      progress: 0,
      message: `Worker received message #${messageCount}`,
      timestamp: Date.now(),
    });
  }

  const { type, taskId, parameters, requestId, timestamp } = event.data;

  if (type === 'execute-task' && taskId === 'generate-platelets') {
    console.log(
      `🔄 Platelet Worker: Starting execution of task ${taskId} for request ${requestId}`,
    );
    console.log(`🔄 Platelet Worker: Task parameters:`, parameters);

    try {
      const startTime = Date.now();
      console.log(
        `⏱️ Platelet Worker: Calling handlePlateletGeneration at ${startTime}`,
      );

      // Use the imported platelet generation function
      console.log(
        '🔧 Platelet Worker: About to call handlePlateletGeneration with parameters:',
        {
          plateId: parameters.plateId,
          planetRadius: parameters.planetRadius,
          resolution: parameters.resolution,
          universeId: parameters.universeId,
          dontClear: parameters.dontClear,
          timestamp: timestamp,
        },
      );

      // Send progress update to parent
      self.postMessage({
        type: 'task-progress',
        taskId,
        requestId,
        progress: 0,
        message: 'Starting platelet generation...',
        timestamp: Date.now(),
      });

      console.log(
        '🔧 Platelet Worker: About to call handlePlateletGeneration - this is where it might hang',
      );

      // Test IndexedDB access before calling handlePlateletGeneration
      console.log('🔧 Platelet Worker: Testing IndexedDB access...');
      self.postMessage({
        type: 'task-progress',
        taskId,
        requestId,
        progress: 5,
        message: 'Testing IndexedDB access...',
        timestamp: Date.now(),
      });

      try {
        // Test basic IndexedDB functionality
        console.log(
          '🔧 Platelet Worker: Checking if IndexedDB is available...',
        );
        if (typeof indexedDB === 'undefined') {
          throw new Error('IndexedDB is not available in worker context');
        }
        console.log('✅ Platelet Worker: IndexedDB is available');

        // Test database listing
        console.log('🔧 Platelet Worker: Listing existing databases...');
        const databases = await indexedDB.databases();
        console.log(
          '✅ Platelet Worker: Found databases:',
          databases.map((db) => db.name),
        );

        self.postMessage({
          type: 'task-progress',
          taskId,
          requestId,
          progress: 8,
          message: `Found ${databases.length} databases: ${databases.map((db) => db.name).join(', ')}`,
          timestamp: Date.now(),
        });

        // Test plate data retrieval
        console.log('🔧 Platelet Worker: Testing plate data retrieval...');
        self.postMessage({
          type: 'task-progress',
          taskId,
          requestId,
          progress: 12,
          message: `Testing plate data retrieval for plateId: ${parameters.plateId}`,
          timestamp: Date.now(),
        });

        try {
          // Try to access the atmo-plates database directly
          const { openDB } = await import('idb');
          const db = await openDB('atmo-plates', 1);

          console.log(
            '✅ Platelet Worker: Successfully opened atmo-plates database',
          );

          // Check if plates object store exists
          if (!db.objectStoreNames.contains('plates')) {
            throw new Error('plates object store not found in database');
          }

          console.log('✅ Platelet Worker: plates object store exists');

          // Try to retrieve the specific plate
          const transaction = db.transaction(['plates'], 'readonly');
          const store = transaction.objectStore('plates');
          const plate = await store.get(parameters.plateId);

          if (plate) {
            console.log(
              '✅ Platelet Worker: Successfully retrieved plate data:',
              {
                id: plate.id,
                planetId: plate.planetId,
                position: plate.position,
                radius: plate.radius,
              },
            );

            self.postMessage({
              type: 'task-progress',
              taskId,
              requestId,
              progress: 15,
              message: `✅ Retrieved plate data: id=${plate.id}, radius=${plate.radius}km, planetId=${plate.planetId}`,
              timestamp: Date.now(),
            });
          } else {
            console.log('❌ Platelet Worker: Plate not found in database');
            self.postMessage({
              type: 'task-progress',
              taskId,
              requestId,
              progress: -2,
              message: `❌ Plate ${parameters.plateId} not found in database`,
              timestamp: Date.now(),
            });
            throw new Error(
              `Plate ${parameters.plateId} not found in database`,
            );
          }

          db.close();
        } catch (plateError) {
          console.error(
            '❌ Platelet Worker: Plate retrieval failed:',
            plateError,
          );
          self.postMessage({
            type: 'task-progress',
            taskId,
            requestId,
            progress: -2,
            message: `❌ Plate retrieval failed: ${plateError.message}`,
            timestamp: Date.now(),
          });
          throw plateError;
        }
      } catch (dbError) {
        console.error('❌ Platelet Worker: IndexedDB test failed:', dbError);
        self.postMessage({
          type: 'task-progress',
          taskId,
          requestId,
          progress: -1,
          message: `IndexedDB test failed: ${dbError.message}`,
          timestamp: Date.now(),
        });
        throw dbError;
      }

      // Add a timeout wrapper to detect if handlePlateletGeneration hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error('handlePlateletGeneration timed out after 30 seconds'),
          );
        }, 30000);
      });

      // Worker functionality has been removed from atmo-plates core
      // This would need to be implemented in the visualization layer
      const generationPromise = Promise.reject(
        new Error(
          'Worker functionality not implemented in core module - use main thread PlateletManager instead',
        ),
      );

      console.log(
        '🔧 Platelet Worker: handlePlateletGeneration promise created, racing with timeout...',
      );

      // Send progress update before the potentially hanging call
      self.postMessage({
        type: 'task-progress',
        taskId,
        requestId,
        progress: 10,
        message: 'Calling handlePlateletGeneration...',
        timestamp: Date.now(),
      });

      const result = await Promise.race([generationPromise, timeoutPromise]);

      console.log(
        '🎉 Platelet Worker: handlePlateletGeneration returned successfully!',
      );

      // Send final progress update
      self.postMessage({
        type: 'task-progress',
        taskId,
        requestId,
        progress: 100,
        message: 'Platelet generation completed!',
        timestamp: Date.now(),
      });

      const endTime = Date.now();
      const executionTime = endTime - timestamp;

      console.log(
        `✅ Platelet Worker: handlePlateletGeneration completed in ${endTime - startTime}ms`,
      );
      console.log(`✅ Platelet Worker: Task result:`, result);

      // Send success response in atmo-workers format
      const response = {
        type: 'task-complete',
        taskId,
        requestId,
        success: true,
        result,
        executionTime,
      };

      console.log(
        `📤 Platelet Worker: Sending success response for task ${taskId}:`,
        response,
      );
      self.postMessage(response);
      console.log(
        `📤 Platelet Worker: Success response sent for task ${taskId}`,
      );
    } catch (error) {
      const executionTime = Date.now() - timestamp;
      console.error(`❌ Platelet Worker: Error in task ${taskId}:`, error);

      // Create detailed error information
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        type: typeof error,
        stringified: String(error),
      };

      console.error(`❌ Platelet Worker: Detailed error info:`, errorDetails);

      // Send error response in atmo-workers format
      const errorResponse = {
        type: 'task-complete',
        taskId,
        requestId,
        success: false,
        error: errorDetails.message,
        errorDetails: errorDetails,
        executionTime,
      };

      console.log(
        `📤 Platelet Worker: Sending error response for task ${taskId}:`,
        errorResponse,
      );
      self.postMessage(errorResponse);
      console.log(`📤 Platelet Worker: Error response sent for task ${taskId}`);

      // Also send a separate error message for better visibility
      self.postMessage({
        type: 'worker-task-error',
        taskId,
        requestId,
        error: errorDetails,
        timestamp: Date.now(),
      });
    }
  } else {
    console.log(
      `🤷 Platelet Worker: Ignoring message with type '${type}' and taskId '${taskId}'`,
    );
  }
});

console.log('👂 Platelet Worker: Message event listener registered');

// Add global error handlers to catch any unhandled errors
self.addEventListener('error', (event) => {
  console.error('❌ Platelet Worker: Unhandled error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
  });

  // Send error message to parent
  self.postMessage({
    type: 'worker-unhandled-error',
    error: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      stringified: String(event.error),
    },
    timestamp: Date.now(),
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Platelet Worker: Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
  });

  // Send error message to parent
  self.postMessage({
    type: 'worker-unhandled-rejection',
    error: {
      reason: String(event.reason),
      stack: event.reason?.stack,
      message: event.reason?.message || String(event.reason),
    },
    timestamp: Date.now(),
  });
});

console.log(
  '🤖 Platelet Worker Bridge: Script loaded, but NOT ready yet - need to establish database connection',
);
console.log('🔧 Platelet Worker: Initializing database connection...');

// Initialize database connection before signaling ready
async function initializeWorkerDatabase() {
  try {
    console.log(
      '🔧 Platelet Worker: SKIPPING database initialization to prevent data deletion...',
    );
    console.log(
      '⚠️ Platelet Worker: This worker will NOT initialize PlateSimulation to avoid clearing main thread data',
    );
    console.log(
      '✅ Platelet Worker: Database connection skipped - assuming main thread data is preserved',
    );

    // NOW send worker-ready signal
    const readyMessage = {
      type: 'worker-ready',
      timestamp: Date.now(),
    };

    console.log(
      '📤 Platelet Worker: Database ready - sending worker-ready signal:',
      readyMessage,
    );
    self.postMessage(readyMessage);
    console.log('📤 Platelet Worker: worker-ready signal sent successfully');

    console.log(
      '🤖 Platelet Worker Bridge: Fully initialized and ready for atmo-workers protocol',
    );
    console.log(
      '🤖 Platelet Worker Bridge: Waiting for execute-task messages...',
    );
  } catch (error) {
    console.error(
      '❌ Platelet Worker: Failed to initialize database connection:',
      error,
    );

    // Send error signal to parent thread
    const errorMessage = {
      type: 'worker-error',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown database connection error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
    };

    console.error(
      '📤 Platelet Worker: Sending error signal to parent:',
      errorMessage,
    );
    self.postMessage(errorMessage);

    // Don't send ready signal if database connection fails
    console.error(
      '❌ Platelet Worker: Worker will NOT signal ready due to database connection failure',
    );

    // Terminate the worker since it's not functional
    console.error(
      '💀 Platelet Worker: Terminating worker due to initialization failure',
    );
    self.close();
  }
}

// Initialize database connection
initializeWorkerDatabase();
