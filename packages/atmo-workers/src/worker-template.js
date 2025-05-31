/**
 * Worker Script Template for Atmo Workers
 * 
 * This is a template for creating worker scripts that work with BrowserWorker.
 * Copy this file and implement your task handlers.
 */

// Task handlers - implement your specific task logic here
const taskHandlers = {
  // Example: Math operations
  'add': (parameters) => {
    const { a, b } = parameters;
    return { result: a + b, operation: 'addition' };
  },

  'multiply': (parameters) => {
    const { a, b } = parameters;
    return { result: a * b, operation: 'multiplication' };
  },

  'calculate': (parameters) => {
    const { expression } = parameters;
    try {
      // Note: eval is dangerous in production - use a proper expression parser
      const result = eval(expression);
      return { result, expression };
    } catch (error) {
      throw new Error(`Invalid expression: ${expression}`);
    }
  },

  // Example: Data processing
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
      default:
        throw new Error(`Unknown transform type: ${transformType}`);
    }
  },

  'validate': (parameters) => {
    const { data, schema } = parameters;
    
    // Simple validation example
    const errors = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!data[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data
    };
  },

  // Example: Image processing (using Canvas API)
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

  'filter': (parameters) => {
    const { imageData, filterType } = parameters;
    
    // Placeholder for image filtering
    // In a real implementation, you'd use Canvas API or WebGL
    return {
      filteredImageData: imageData, // Would be the filtered image
      filterApplied: filterType,
      timestamp: Date.now()
    };
  },

  'compress': (parameters) => {
    const { imageData, quality = 0.8 } = parameters;
    
    // Placeholder for image compression
    // In a real implementation, you'd use Canvas API
    return {
      compressedImageData: imageData, // Would be the compressed image
      originalSize: imageData.length,
      compressedSize: Math.floor(imageData.length * quality),
      compressionRatio: quality
    };
  }
};

// Worker message handler
self.addEventListener('message', async (event) => {
  const { type, taskId, parameters, requestId, timestamp } = event.data;
  
  if (type === 'execute-task') {
    console.log(`🔄 Worker executing task: ${taskId}`, parameters);
    
    try {
      const handler = taskHandlers[taskId];
      
      if (!handler) {
        throw new Error(`Unknown task: ${taskId}`);
      }
      
      // Execute the task handler
      const result = await handler(parameters);
      
      // Send success response
      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: true,
        result,
        executionTime: Date.now() - timestamp
      });
      
      console.log(`✅ Worker completed task: ${taskId}`);
      
    } catch (error) {
      // Send error response
      self.postMessage({
        type: 'task-complete',
        taskId,
        requestId,
        success: false,
        error: error.message,
        executionTime: Date.now() - timestamp
      });
      
      console.error(`❌ Worker failed task: ${taskId}`, error);
    }
  }
});

// Worker initialization
console.log('🚀 Atmo Worker initialized and ready to process tasks');

// Optional: Send ready signal
self.postMessage({
  type: 'worker-ready',
  timestamp: Date.now()
});
