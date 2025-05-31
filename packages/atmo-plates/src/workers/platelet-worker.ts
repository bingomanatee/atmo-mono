/**
 * Platelet Generation Web Worker
 * 
 * This worker performs heavy platelet generation computations off the main thread
 * using the shared multiverse database approach.
 * 
 * Strategy 2: Uses shared utility module for clean dependency management
 */

import { 
  initWorkerMultiverse, 
  performGridDiskComputationWorker 
} from './shared/multiverse-worker-utils';

// Worker message interface
interface WorkerMessage {
  plateId: string;
  planetRadius: number;
  resolution: number;
  universeId: string;
  dontClear: boolean;
  timestamp: number;
}

interface WorkerResponse {
  success: boolean;
  plateId?: string;
  plateletCount?: number;
  plateletIds?: string[];
  message?: string;
  error?: string;
  timestamp?: number;
  usedMultiverse?: boolean;
  dontClearMode?: boolean;
}

self.onmessage = async function(e: MessageEvent<WorkerMessage>) {
  const { plateId, planetRadius, resolution, universeId, dontClear, timestamp } = e.data;
  
  console.log('🔧 Worker: Starting platelet generation');
  console.log('🔧 Worker: Universe ID:', universeId);
  console.log('🔧 Worker: Plate ID:', plateId);
  console.log('🔧 Worker: DontClear:', dontClear);
  
  try {
    // Initialize multiverse with dontClear flag to preserve existing data
    const multiverse = await initWorkerMultiverse(universeId, dontClear);
    
    console.log('✅ Worker: Multiverse initialized successfully');
    
    // Perform the actual gridDisk computation
    const result = await performGridDiskComputationWorker(
      plateId,
      planetRadius,
      resolution,
      multiverse
    );
    
    console.log(`✅ Worker: Generated ${result.plateletCount} platelets for plate ${plateId}`);
    
    // Send success response
    const response: WorkerResponse = {
      success: true,
      plateId: result.plateId,
      plateletCount: result.plateletCount,
      plateletIds: result.plateletIds,
      message: `Generated ${result.plateletCount} platelets using worker`,
      timestamp: timestamp,
      usedMultiverse: true,
      dontClearMode: dontClear
    };
    
    self.postMessage(response);
    
  } catch (error) {
    console.error('❌ Worker error:', error);
    
    // Send error response
    const response: WorkerResponse = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      plateId: plateId,
      timestamp: timestamp,
      usedMultiverse: false,
      dontClearMode: dontClear
    };
    
    self.postMessage(response);
  }
};

// Handle worker errors
self.onerror = function(error) {
  console.error('❌ Worker global error:', error);
  
  const response: WorkerResponse = {
    success: false,
    error: `Worker global error: ${error.message}`,
    usedMultiverse: false
  };
  
  self.postMessage(response);
};

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
  console.error('❌ Worker unhandled rejection:', event.reason);
  
  const response: WorkerResponse = {
    success: false,
    error: `Worker unhandled rejection: ${event.reason}`,
    usedMultiverse: false
  };
  
  self.postMessage(response);
});

console.log('🔧 Platelet Worker initialized and ready');
