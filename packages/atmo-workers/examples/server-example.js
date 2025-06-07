const { TaskManager, ServerWorkerManager } = require('@wonderlandlabs/atmo-workers');
const path = require('path');
const os = require('os');

async function serverWorkerExample() {
  console.log('🚀 Starting Server Worker Example');
  console.log(`💻 CPU Cores: ${os.cpus().length}`);
  
  const taskManager = new TaskManager();
  
  const workerManager = new ServerWorkerManager({
    manager: taskManager,
    configs: [
      {
        tasks: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'heavy-computation'],
        script: path.join(__dirname, 'server-math-worker.js')
      },
      {
        tasks: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'heavy-computation'],
        script: path.join(__dirname, 'server-math-worker.js')
      },
      {
        tasks: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'heavy-computation'],
        script: path.join(__dirname, 'server-math-worker.js')
      },
      {
        tasks: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'heavy-computation'],
        script: path.join(__dirname, 'server-math-worker.js')
      }
    ]
  });

  console.log(`👷 Created ${workerManager.workers.length} server workers`);

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n📊 Running CPU-intensive tasks across multiple cores...');
  
  const startTime = Date.now();
  let completedTasks = 0;
  const totalTasks = 20;

  for (let i = 0; i < totalTasks; i++) {
    taskManager.addTask({
      name: 'heavy-computation',
      params: { iterations: 5000000 },
      onSuccess: (result) => {
        completedTasks++;
        console.log(`✅ Task ${completedTasks}/${totalTasks} completed: ${result.content.toFixed(4)}`);
        
        if (completedTasks === totalTasks) {
          const duration = Date.now() - startTime;
          console.log(`\n🎉 All tasks completed in ${duration}ms`);
          console.log(`⚡ Average: ${(duration / totalTasks).toFixed(2)}ms per task`);
          
          cleanup();
        }
      },
      onError: (error) => {
        console.error('❌ Task failed:', error.error);
        completedTasks++;
        
        if (completedTasks === totalTasks) {
          cleanup();
        }
      }
    });
  }

  function cleanup() {
    console.log('\n🧹 Cleaning up...');
    workerManager.close();
    taskManager.close();
    console.log('✨ Cleanup complete');
  }

  setTimeout(() => {
    console.log('\n⏰ Timeout reached, forcing cleanup...');
    cleanup();
  }, 30000);
}

async function basicMathExample() {
  console.log('\n🔢 Basic Math Operations Example');
  
  const taskManager = new TaskManager();
  
  const workerManager = new ServerWorkerManager({
    manager: taskManager,
    configs: [
      {
        tasks: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt'],
        script: path.join(__dirname, 'server-math-worker.js')
      }
    ]
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  const operations = [
    { name: 'add', params: { a: 10, b: 5 }, expected: 15 },
    { name: 'subtract', params: { a: 10, b: 3 }, expected: 7 },
    { name: 'multiply', params: { a: 4, b: 6 }, expected: 24 },
    { name: 'divide', params: { a: 20, b: 4 }, expected: 5 },
    { name: 'power', params: { a: 2, b: 8 }, expected: 256 },
    { name: 'sqrt', params: { a: 16 }, expected: 4 }
  ];

  let completed = 0;

  operations.forEach((op, index) => {
    taskManager.addTask({
      name: op.name,
      params: op.params,
      onSuccess: (result) => {
        const actual = result.content;
        const match = actual === op.expected ? '✅' : '❌';
        console.log(`${match} ${op.name}(${Object.values(op.params).join(', ')}) = ${actual} (expected: ${op.expected})`);
        
        completed++;
        if (completed === operations.length) {
          console.log('\n🎯 Basic math operations complete!');
          workerManager.close();
          taskManager.close();
        }
      },
      onError: (error) => {
        console.error(`❌ ${op.name} failed:`, error.error);
        completed++;
        if (completed === operations.length) {
          workerManager.close();
          taskManager.close();
        }
      }
    });
  });
}

if (require.main === module) {
  basicMathExample()
    .then(() => serverWorkerExample())
    .catch(console.error);
}

module.exports = { serverWorkerExample, basicMathExample };
