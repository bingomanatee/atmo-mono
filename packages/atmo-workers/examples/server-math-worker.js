const { parentPort } = require('worker_threads');

let myWorkerId = null;

if (parentPort) {
  parentPort.on('message', (data) => {
    const { message, taskId, content, workerId } = data;
    
    switch (message) {
      case 'init-worker':
        myWorkerId = data.id;
        parentPort.postMessage({
          message: 'worker-ready',
          workerId: myWorkerId,
          content: { tasks: data.content }
        });
        break;
        
      case 'worker-work':
        handleTask(taskId, content);
        break;
    }
  });
}

async function handleTask(taskId, content) {
  try {
    const { name, params } = content;
    let result;
    
    switch (name) {
      case 'add':
        result = params.a + params.b;
        break;
      case 'subtract':
        result = params.a - params.b;
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
      case 'power':
        result = Math.pow(params.a, params.b);
        break;
      case 'sqrt':
        if (params.a < 0) {
          throw new Error('Cannot calculate square root of negative number');
        }
        result = Math.sqrt(params.a);
        break;
      case 'heavy-computation':
        result = 0;
        for (let i = 0; i < params.iterations || 1000000; i++) {
          result += Math.sin(i) * Math.cos(i);
        }
        break;
      default:
        throw new Error(`Unknown task: ${name}`);
    }
    
    if (parentPort) {
      parentPort.postMessage({
        message: 'worker-response',
        taskId,
        workerId: myWorkerId,
        content: result
      });
    }
  } catch (error) {
    if (parentPort) {
      parentPort.postMessage({
        message: 'worker-response',
        taskId,
        workerId: myWorkerId,
        error: error.message
      });
    }
  }
}

function logWorkerInfo(message) {
  console.log(`[Server Worker ${myWorkerId}] ${message}`);
}
