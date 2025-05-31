# Browser Workers - Client-side Multiprocessing

This guide covers using Atmo Workers in browser environments with Web Workers for true client-side multiprocessing.

## Overview

Browser Workers enable you to offload heavy computations to separate threads, keeping your main UI thread responsive. Each worker runs in its own thread and can handle specific types of tasks.

## Quick Start

### 1. Create Worker Scripts

First, create your worker scripts. Use the provided template as a starting point:

```javascript
// public/workers/math-worker.js
const taskHandlers = {
  'add': (parameters) => {
    const { a, b } = parameters;
    return { result: a + b, operation: 'addition' };
  },
  
  'multiply': (parameters) => {
    const { a, b } = parameters;
    return { result: a * b, operation: 'multiplication' };
  },
  
  'fibonacci': (parameters) => {
    const { n } = parameters;
    function fib(num) {
      if (num <= 1) return num;
      return fib(num - 1) + fib(num - 2);
    }
    return { result: fib(n), input: n };
  }
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
        executionTime: Date.now() - timestamp
      });
    } catch (error) {
      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: false,
        error: error.message,
        executionTime: Date.now() - timestamp
      });
    }
  }
});

console.log('Math Worker initialized');
```

### 2. Set Up Browser Worker Manager

```typescript
import { createBrowserWorkerManager } from '@wonderlandlabs/atmo-workers';

const { taskManager, browserWorker } = createBrowserWorkerManager({
  name: 'my-app-workers',
  window: window,
  workerManifests: [
    {
      name: 'math-worker',
      scriptUrl: '/workers/math-worker.js',
      tasks: ['add', 'multiply', 'fibonacci'],
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
```

### 3. Submit Tasks

```typescript
// Submit tasks that will run on different workers
const mathTask = taskManager.submitRequest(
  'fibonacci',
  { n: 40 },
  { clientId: 'math-client' }
);

const dataTask = taskManager.submitRequest(
  'fetch',
  { url: 'https://api.example.com/data' },
  { clientId: 'data-client' }
);

// Handle results
mathTask.subscribe({
  next: (result) => console.log('Math result:', result),
  error: (error) => console.error('Math error:', error),
});

dataTask.subscribe({
  next: (result) => console.log('Data result:', result),
  error: (error) => console.error('Data error:', error),
});

// Or use Promise-style
try {
  const [mathResult, dataResult] = await Promise.all([
    mathTask.toPromise(),
    dataTask.toPromise(),
  ]);
  console.log('All results:', { mathResult, dataResult });
} catch (error) {
  console.error('Task failed:', error);
}
```

## Worker Script Examples

### Data Processing Worker

```javascript
// public/workers/data-worker.js
const taskHandlers = {
  'fetch': async (parameters) => {
    const { url, options = {} } = parameters;
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      return { data, url, status: response.status };
    } catch (error) {
      throw new Error(`Fetch failed: ${error.message}`);
    }
  },

  'transform': (parameters) => {
    const { data, transformType } = parameters;
    
    switch (transformType) {
      case 'uppercase':
        return { transformed: data.toString().toUpperCase() };
      case 'lowercase':
        return { transformed: data.toString().toLowerCase() };
      case 'reverse':
        return { transformed: data.toString().split('').reverse().join('') };
      case 'sort':
        if (Array.isArray(data)) {
          return { transformed: [...data].sort() };
        }
        throw new Error('Sort transform requires array data');
      default:
        throw new Error(`Unknown transform type: ${transformType}`);
    }
  },

  'validate': (parameters) => {
    const { data, schema } = parameters;
    const errors = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!data[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (data[field] && typeof data[field] !== expectedType) {
          errors.push(`Field ${field} should be ${expectedType}, got ${typeof data[field]}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data
    };
  }
};

// Standard worker message handler
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
        executionTime: Date.now() - timestamp
      });
    } catch (error) {
      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: false,
        error: error.message,
        executionTime: Date.now() - timestamp
      });
    }
  }
});

console.log('Data Worker initialized');
```

### Image Processing Worker

```javascript
// public/workers/image-worker.js
const taskHandlers = {
  'resize': async (parameters) => {
    const { imageData, width, height } = parameters;
    
    // Create canvas for image processing
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Create image from data
    const img = new Image();
    img.src = imageData;
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.convertToBlob().then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              resizedImageData: reader.result,
              originalSize: { width: img.width, height: img.height },
              newSize: { width, height }
            });
          };
          reader.readAsDataURL(blob);
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    });
  },

  'filter': async (parameters) => {
    const { imageData, filterType, intensity = 1.0 } = parameters;
    
    // Create canvas for filtering
    const img = new Image();
    img.src = imageData;
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0);
        const imageDataObj = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageDataObj.data;
        
        // Apply filter based on type
        switch (filterType) {
          case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i] = data[i + 1] = data[i + 2] = gray * intensity + data[i] * (1 - intensity);
            }
            break;
          case 'sepia':
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
              data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
              data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
            }
            break;
          case 'invert':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }
            break;
        }
        
        ctx.putImageData(imageDataObj, 0, 0);
        canvas.convertToBlob().then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              filteredImageData: reader.result,
              filterApplied: filterType,
              intensity,
              originalSize: { width: img.width, height: img.height }
            });
          };
          reader.readAsDataURL(blob);
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    });
  },

  'compress': async (parameters) => {
    const { imageData, quality = 0.8, format = 'image/jpeg' } = parameters;
    
    const img = new Image();
    img.src = imageData;
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0);
        canvas.convertToBlob({ type: format, quality }).then(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              compressedImageData: reader.result,
              originalSize: imageData.length,
              compressedSize: blob.size,
              compressionRatio: blob.size / imageData.length,
              quality,
              format
            });
          };
          reader.readAsDataURL(blob);
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    });
  }
};

// Standard worker message handler
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
        executionTime: Date.now() - timestamp
      });
    } catch (error) {
      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: false,
        error: error.message,
        executionTime: Date.now() - timestamp
      });
    }
  }
});

console.log('Image Worker initialized');
```

## Advanced Usage

### Monitoring Workers

```typescript
// Get real-time worker status
const status = browserWorker.getWorkerStatus();
status.forEach(worker => {
  console.log(`Worker: ${worker.name}`);
  console.log(`  Busy: ${worker.busy}`);
  console.log(`  Tasks completed: ${worker.tasksCompleted}`);
  console.log(`  Current task: ${worker.currentTask || 'none'}`);
  console.log(`  Handles: ${worker.tasks.join(', ')}`);
});

// Monitor worker performance
setInterval(() => {
  const workers = browserWorker.getWorkerStatus();
  const totalTasks = workers.reduce((sum, w) => sum + w.tasksCompleted, 0);
  const busyWorkers = workers.filter(w => w.busy).length;
  
  console.log(`Total tasks completed: ${totalTasks}`);
  console.log(`Busy workers: ${busyWorkers}/${workers.length}`);
}, 5000);
```

### Error Handling

```typescript
// Handle worker errors gracefully
taskManager.submitRequest('complex-calculation', { data: largeDataset })
  .subscribe({
    next: (result) => {
      console.log('Calculation completed:', result);
    },
    error: (error) => {
      console.error('Calculation failed:', error);
      // Fallback to main thread or retry
      fallbackCalculation(largeDataset);
    }
  });
```

### Dynamic Worker Management

```typescript
// Add workers at runtime (if needed)
const newWorker = new Worker('/workers/specialized-worker.js');
browserWorker.registerWorkerScript('specialized-task', newWorker);

// Clean up when done
window.addEventListener('beforeunload', () => {
  browserWorker.terminate();
});
```

## Best Practices

### 1. **Worker Script Organization**
- Keep worker scripts focused on specific domains (math, data, images)
- Use consistent error handling patterns
- Include proper logging for debugging

### 2. **Task Design**
- Make tasks stateless and self-contained
- Avoid sharing large objects between main thread and workers
- Use transferable objects for large data when possible

### 3. **Performance Optimization**
- Monitor worker utilization and adjust `maxConcurrentTasks`
- Use appropriate timeouts for different task types
- Consider worker warm-up for frequently used operations

### 4. **Error Recovery**
- Implement fallback strategies for critical operations
- Use retries for transient failures
- Provide meaningful error messages to users

### 5. **Resource Management**
- Always call `browserWorker.terminate()` when done
- Monitor memory usage in long-running applications
- Consider worker recycling for memory-intensive tasks

## Browser Compatibility

- **Modern Browsers**: Full support (Chrome 4+, Firefox 3.5+, Safari 4+)
- **Web Workers**: Required for multiprocessing
- **OffscreenCanvas**: Required for image processing (Chrome 69+, Firefox 105+)
- **Transferable Objects**: Recommended for large data transfers

## Troubleshooting

### Common Issues

1. **Worker Script Not Loading**
   - Check file paths and CORS policies
   - Ensure scripts are served over HTTP/HTTPS

2. **Tasks Timing Out**
   - Increase `workerTimeout` for long-running tasks
   - Check for infinite loops in worker code

3. **Memory Issues**
   - Avoid keeping large objects in worker memory
   - Use transferable objects for large data
   - Terminate workers when done

4. **CORS Errors**
   - Serve worker scripts from same origin
   - Configure proper CORS headers if needed

### Debugging

```typescript
// Enable detailed logging
const { taskManager, browserWorker } = createBrowserWorkerManager({
  name: 'debug-workers',
  window: window,
  workerManifests: [...],
  workerTimeout: 60000, // Longer timeout for debugging
});

// Monitor all task events
taskManager.subscribe(event => {
  console.log('Task event:', event);
});
```
