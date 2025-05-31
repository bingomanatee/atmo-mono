# Node.js Workers - Server-side Task Processing

This guide covers using Atmo Workers in Node.js environments with Worker Threads and process-based task handling.

## Overview

Node.js Workers enable you to offload CPU-intensive tasks to separate threads or processes, keeping your main event loop responsive. This is essential for server applications that need to handle concurrent requests while performing heavy computations.

## Quick Start

### 1. Basic WorkerResponder Setup

```typescript
import { createWorkerManager } from '@wonderlandlabs/atmo-workers';

// Create a worker manager with task handlers
const { taskManager, workerResponder } = createWorkerManager({
  name: 'node-server',
  taskHandlers: {
    'cpu-intensive': async (parameters, utilities) => {
      const { iterations } = parameters;
      
      // Simulate CPU-intensive work
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i);
      }
      
      utilities.logger.info(`Completed ${iterations} iterations`);
      return { result, iterations };
    },
    
    'file-processing': async (parameters, utilities) => {
      const { filePath, operation } = parameters;
      
      const content = await utilities.fs.readFile(filePath);
      
      switch (operation) {
        case 'count-lines':
          const lines = content.split('\n').length;
          return { lines, filePath };
        case 'word-count':
          const words = content.split(/\s+/).length;
          return { words, filePath };
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    },
    
    'database-query': async (parameters, utilities) => {
      const { query, params } = parameters;
      
      const results = await utilities.db.query(query, params);
      return { results, rowCount: results.length };
    },
    
    'http-request': async (parameters, utilities) => {
      const { url, method = 'GET', data } = parameters;
      
      const response = await utilities.http.get(url);
      const responseData = await response.json();
      
      return { data: responseData, status: response.status };
    }
  }
});

// Submit tasks
const result$ = taskManager.submitRequest(
  'cpu-intensive',
  { iterations: 1000000 },
  { clientId: 'server-1' }
);

result$.subscribe({
  next: (result) => console.log('Task completed:', result),
  error: (error) => console.error('Task failed:', error),
});
```

### 2. Express.js Integration

```typescript
import express from 'express';
import { createWorkerManager } from '@wonderlandlabs/atmo-workers';

const app = express();
app.use(express.json());

// Initialize worker manager
const { taskManager } = createWorkerManager({
  name: 'api-server',
  taskHandlers: {
    'image-resize': async (parameters, utilities) => {
      const { imageBuffer, width, height } = parameters;
      // Use sharp or similar library for image processing
      // This runs in the main thread but could be moved to worker threads
      return { resizedImage: 'base64...', originalSize: imageBuffer.length };
    },
    
    'data-analysis': async (parameters, utilities) => {
      const { dataset } = parameters;
      
      // Perform statistical analysis
      const mean = dataset.reduce((a, b) => a + b, 0) / dataset.length;
      const variance = dataset.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dataset.length;
      const stdDev = Math.sqrt(variance);
      
      return { mean, variance, stdDev, count: dataset.length };
    }
  }
});

// API endpoints that use workers
app.post('/api/analyze', async (req, res) => {
  try {
    const { data } = req.body;
    
    const result$ = taskManager.submitRequest(
      'data-analysis',
      { dataset: data },
      { clientId: req.ip }
    );
    
    const result = await result$.toPromise();
    res.json({ success: true, analysis: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/process-image', async (req, res) => {
  try {
    const { imageData, width, height } = req.body;
    
    const result$ = taskManager.submitRequest(
      'image-resize',
      { imageBuffer: Buffer.from(imageData, 'base64'), width, height },
      { clientId: req.ip }
    );
    
    const result = await result$.toPromise();
    res.json({ success: true, image: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 3. Custom Utilities for Node.js

```typescript
import { createWorkerManager, WorkerUtilities } from '@wonderlandlabs/atmo-workers';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg'; // PostgreSQL client
import fetch from 'node-fetch';

// Create custom utilities for your Node.js environment
const customUtilities: WorkerUtilities = {
  fs: {
    readFile: async (filePath: string) => {
      return await fs.readFile(path.resolve(filePath), 'utf-8');
    },
    writeFile: async (filePath: string, content: string) => {
      await fs.writeFile(path.resolve(filePath), content, 'utf-8');
    },
    exists: async (filePath: string) => {
      try {
        await fs.access(path.resolve(filePath));
        return true;
      } catch {
        return false;
      }
    },
    mkdir: async (dirPath: string) => {
      await fs.mkdir(path.resolve(dirPath), { recursive: true });
    }
  },
  
  db: {
    query: async (sql: string, params?: any[]) => {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      const result = await pool.query(sql, params);
      await pool.end();
      return result.rows;
    },
    execute: async (sql: string, params?: any[]) => {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      const result = await pool.query(sql, params);
      await pool.end();
      return { affectedRows: result.rowCount };
    },
    transaction: async (callback) => {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        const result = await callback({
          query: (sql, params) => client.query(sql, params).then(r => r.rows),
          execute: (sql, params) => client.query(sql, params).then(r => ({ affectedRows: r.rowCount })),
          transaction: () => Promise.reject(new Error('Nested transactions not supported'))
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
        await pool.end();
      }
    }
  },
  
  http: {
    get: async (url: string) => {
      const response = await fetch(url);
      return {
        json: () => response.json(),
        text: () => response.text(),
        status: response.status,
        headers: response.headers
      };
    },
    post: async (url: string, data?: any) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return {
        json: () => response.json(),
        text: () => response.text(),
        status: response.status,
        headers: response.headers
      };
    },
    put: async (url: string, data?: any) => {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return {
        json: () => response.json(),
        text: () => response.text(),
        status: response.status,
        headers: response.headers
      };
    },
    delete: async (url: string) => {
      const response = await fetch(url, { method: 'DELETE' });
      return {
        json: () => response.json(),
        text: () => response.text(),
        status: response.status,
        headers: response.headers
      };
    }
  },
  
  logger: {
    info: (message: string, meta?: any) => {
      console.log(`[INFO] ${message}`, meta || '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[WARN] ${message}`, meta || '');
    },
    error: (message: string, meta?: any) => {
      console.error(`[ERROR] ${message}`, meta || '');
    },
    debug: (message: string, meta?: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[DEBUG] ${message}`, meta || '');
      }
    }
  },
  
  worker: {
    createWorker: (scriptPath: string) => {
      // For Node.js, this could create Worker Threads
      // or return a mock for main-thread processing
      return {
        postMessage: (message: any) => {
          console.log('Node worker would process:', message);
        },
        terminate: () => {
          console.log('Node worker terminated');
        }
      };
    },
    terminateWorker: (worker: any) => {
      if (worker.terminate) worker.terminate();
    },
    postMessage: (worker: any, message: any) => {
      if (worker.postMessage) worker.postMessage(message);
    },
    addEventListener: (worker: any, type: string, listener: Function) => {
      // Mock implementation for Node.js
    },
    removeEventListener: (worker: any, type: string, listener: Function) => {
      // Mock implementation for Node.js
    }
  }
};

// Use custom utilities
const { taskManager } = createWorkerManager({
  name: 'custom-node-server',
  utilities: customUtilities,
  taskHandlers: {
    'process-file': async (parameters, utilities) => {
      const { inputFile, outputFile } = parameters;
      
      const content = await utilities.fs.readFile(inputFile);
      const processed = content.toUpperCase(); // Example processing
      await utilities.fs.writeFile(outputFile, processed);
      
      utilities.logger.info(`Processed file: ${inputFile} -> ${outputFile}`);
      return { inputFile, outputFile, size: processed.length };
    }
  }
});
```

## Advanced Patterns

### 1. Background Job Processing

```typescript
import { createWorkerManager } from '@wonderlandlabs/atmo-workers';
import cron from 'node-cron';

const { taskManager } = createWorkerManager({
  name: 'background-jobs',
  taskHandlers: {
    'cleanup-temp-files': async (parameters, utilities) => {
      const { directory, maxAge } = parameters;
      
      // Implementation for cleaning up old files
      utilities.logger.info(`Cleaning up files older than ${maxAge} days in ${directory}`);
      return { cleaned: true, directory };
    },
    
    'generate-reports': async (parameters, utilities) => {
      const { reportType, dateRange } = parameters;
      
      // Generate reports from database
      const data = await utilities.db.query(
        'SELECT * FROM analytics WHERE date BETWEEN $1 AND $2',
        [dateRange.start, dateRange.end]
      );
      
      return { reportType, recordCount: data.length, generated: new Date() };
    },
    
    'send-notifications': async (parameters, utilities) => {
      const { recipients, message } = parameters;
      
      // Send notifications via email/SMS
      for (const recipient of recipients) {
        await utilities.http.post('https://api.notifications.com/send', {
          to: recipient,
          message
        });
      }
      
      return { sent: recipients.length, message };
    }
  }
});

// Schedule background jobs
cron.schedule('0 2 * * *', () => {
  // Daily cleanup at 2 AM
  taskManager.submitRequest(
    'cleanup-temp-files',
    { directory: '/tmp', maxAge: 7 },
    { clientId: 'cron-cleanup' }
  ).subscribe({
    next: (result) => console.log('Cleanup completed:', result),
    error: (error) => console.error('Cleanup failed:', error)
  });
});

cron.schedule('0 6 * * 1', () => {
  // Weekly reports on Monday at 6 AM
  taskManager.submitRequest(
    'generate-reports',
    { 
      reportType: 'weekly',
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      }
    },
    { clientId: 'cron-reports' }
  ).subscribe({
    next: (result) => console.log('Report generated:', result),
    error: (error) => console.error('Report failed:', error)
  });
});
```

### 2. Queue-based Processing

```typescript
import { createWorkerManager } from '@wonderlandlabs/atmo-workers';
import Bull from 'bull';

const { taskManager } = createWorkerManager({
  name: 'queue-processor',
  taskHandlers: {
    'process-video': async (parameters, utilities) => {
      const { videoPath, outputFormat } = parameters;
      
      utilities.logger.info(`Processing video: ${videoPath}`);
      
      // Simulate video processing (use ffmpeg in real implementation)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return { 
        processed: true, 
        inputPath: videoPath, 
        outputFormat,
        duration: '00:05:30'
      };
    },
    
    'resize-images': async (parameters, utilities) => {
      const { imagePaths, sizes } = parameters;
      
      const results = [];
      for (const imagePath of imagePaths) {
        for (const size of sizes) {
          // Process each image at each size
          results.push({
            original: imagePath,
            size,
            output: `${imagePath}_${size.width}x${size.height}.jpg`
          });
        }
      }
      
      return { processed: results.length, results };
    }
  }
});

// Create Bull queue
const videoQueue = new Bull('video processing', {
  redis: { port: 6379, host: '127.0.0.1' }
});

// Process queue jobs with Atmo Workers
videoQueue.process('process-video', async (job) => {
  const result$ = taskManager.submitRequest(
    'process-video',
    job.data,
    { clientId: `queue-${job.id}` }
  );
  
  return await result$.toPromise();
});

// Add jobs to queue
videoQueue.add('process-video', {
  videoPath: '/uploads/video1.mp4',
  outputFormat: 'webm'
});
```

### 3. Microservice Communication

```typescript
import { createWorkerManager } from '@wonderlandlabs/atmo-workers';
import express from 'express';

const app = express();
app.use(express.json());

const { taskManager } = createWorkerManager({
  name: 'microservice',
  taskHandlers: {
    'user-analytics': async (parameters, utilities) => {
      const { userId, timeRange } = parameters;
      
      // Fetch user data from multiple sources
      const [profile, activity, preferences] = await Promise.all([
        utilities.http.get(`http://user-service/users/${userId}`),
        utilities.http.get(`http://activity-service/activity/${userId}?range=${timeRange}`),
        utilities.http.get(`http://preference-service/preferences/${userId}`)
      ]);
      
      const profileData = await profile.json();
      const activityData = await activity.json();
      const preferencesData = await preferences.json();
      
      // Perform analytics
      const analytics = {
        userId,
        totalActivity: activityData.events.length,
        avgSessionTime: activityData.avgSessionTime,
        topCategories: preferencesData.categories.slice(0, 5),
        engagement: calculateEngagement(activityData, preferencesData)
      };
      
      return analytics;
    }
  }
});

function calculateEngagement(activity: any, preferences: any): number {
  // Complex engagement calculation
  return Math.random() * 100; // Simplified for example
}

// API endpoint
app.get('/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = '30d' } = req.query;
    
    const result$ = taskManager.submitRequest(
      'user-analytics',
      { userId, timeRange },
      { clientId: req.ip }
    );
    
    const analytics = await result$.toPromise();
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Analytics microservice running on port 3001');
});
```

## Best Practices

### 1. **Error Handling**
```typescript
const { taskManager } = createWorkerManager({
  name: 'robust-server',
  taskHandlers: {
    'risky-operation': async (parameters, utilities) => {
      try {
        // Risky operation
        const result = await performRiskyOperation(parameters);
        return result;
      } catch (error) {
        utilities.logger.error('Risky operation failed', { error: error.message, parameters });
        
        // Attempt recovery or fallback
        if (error.code === 'TEMPORARY_FAILURE') {
          utilities.logger.info('Attempting fallback operation');
          return await fallbackOperation(parameters);
        }
        
        throw error; // Re-throw if no recovery possible
      }
    }
  }
});
```

### 2. **Resource Management**
```typescript
// Monitor system resources
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
  });
}, 30000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  // Clean up resources, close connections, etc.
  process.exit(0);
});
```

### 3. **Performance Monitoring**
```typescript
import { performance } from 'perf_hooks';

const { taskManager } = createWorkerManager({
  name: 'monitored-server',
  taskHandlers: {
    'monitored-task': async (parameters, utilities) => {
      const startTime = performance.now();
      
      try {
        const result = await performTask(parameters);
        
        const duration = performance.now() - startTime;
        utilities.logger.info(`Task completed in ${duration.toFixed(2)}ms`);
        
        return { ...result, executionTime: duration };
      } catch (error) {
        const duration = performance.now() - startTime;
        utilities.logger.error(`Task failed after ${duration.toFixed(2)}ms`, error);
        throw error;
      }
    }
  }
});
```

## Environment Configuration

### Development
```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const { taskManager } = createWorkerManager({
  name: 'dev-server',
  testMode: isDevelopment,
  utilities: isDevelopment ? createTestUtilities() : createProductionUtilities(),
  taskHandlers: {
    // Your task handlers
  }
});
```

### Production
```typescript
const { taskManager } = createWorkerManager({
  name: 'prod-server',
  testMode: false,
  utilities: createProductionUtilities(),
  taskHandlers: {
    // Optimized task handlers for production
  }
});

// Production monitoring
taskManager.subscribe(event => {
  if (event.type === 'request-failed') {
    // Send to error tracking service
    console.error('Task failed in production:', event);
  }
});
```

## Deployment Considerations

- **Memory Management**: Monitor heap usage and implement cleanup
- **Error Tracking**: Integrate with services like Sentry or Rollbar
- **Logging**: Use structured logging with correlation IDs
- **Health Checks**: Implement endpoints for load balancer health checks
- **Graceful Shutdown**: Handle SIGTERM for clean container shutdowns
- **Resource Limits**: Set appropriate CPU and memory limits
- **Monitoring**: Use APM tools like New Relic or DataDog
