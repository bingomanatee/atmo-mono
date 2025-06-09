import './style.css';
import {
  PlateletManager,
  PlateSpectrumGenerator,
  type SimPlateIF,
} from '@wonderlandlabs/atmo-plates';
import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import * as THREE from 'three';
import { createPlateSimulation } from './utils/simulationUtils';
import {
  TaskManager,
  BrowserWorkerManager,
  TASK_STATUS,
  type ITaskParams,
} from '@wonderlandlabs/atmo-workers/browser';

import { PlateletVisualizer } from './PlateletVisualizer';
import { createThreeScene } from './threeSetup';

// Three.js scene will be created inside the main function to avoid conflicts

// --- Simulation Setup ---
const NUM_PLATES = 20;

// Database cleanup is now handled centrally in the simulation initialization

async function generateAndVisualizePlatelets() {
  // Create simulation using visualization utilities with proper database clearing
  console.log('🔧 Creating simulation with database clearing...');
  const sim = await createPlateSimulation({
    plateCount: NUM_PLATES,
    clearDatabases: true, // This uses the visualization layer's database utilities
  });
  console.log('✅ Simulation created and initialized successfully');

  if (!sim.simUniv) {
    throw new Error('Simulation universe not initialized properly');
  }

  console.log('🎯 Simulation ready - proceeding to platelet generation...');

  // Update storage info in UI
  const storageTypeElement = document.getElementById('storage-type');
  if (storageTypeElement) {
    storageTypeElement.textContent = 'IDBSun (Shared IndexedDB)';
    storageTypeElement.style.color = '#4CAF50'; // Green color to indicate success
  }

  // Setup worker system early (before plate generation)
  console.log('🤖 Setting up worker system...');
  const taskManager = new TaskManager();

  // Start with a reasonable number of workers (we'll adjust later based on plate count)
  const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);
  console.log(
    `🤖 Creating ${maxWorkers} workers (will adjust based on plate count later)`,
  );

  const workerConfigs = Array.from({ length: maxWorkers }, (_, index) => ({
    script: new URL('./platelet-worker.ts', import.meta.url).href,
    tasks: ['generate-platelets'],
  }));

  const workerManager = new BrowserWorkerManager({
    configs: workerConfigs,
  });

  // Connect task manager to worker manager
  workerManager.assignTaskManager(taskManager);

  // Start worker initialization in parallel with plate setup
  console.log('⏳ Starting worker initialization in parallel...');
  const workerInitPromise = new Promise((resolve) => setTimeout(resolve, 1000));

  // Create Three.js scene
  console.log('🎬 Creating Three.js scene...');
  const { scene, camera, renderer, controls } = createThreeScene();
  console.log('✅ Three.js scene created:', {
    scene: !!scene,
    camera: !!camera,
    renderer: !!renderer,
    controls: !!controls,
    rendererDomElement: !!renderer.domElement,
  });

  // --- Add 20 Large Plates ---
  // Generate 20 large plates using Earth radius
  const planet = await sim.planet();
  const largePlates = PlateSpectrumGenerator.generateLargePlates({
    planetRadius: planet.radius, // Get radius from planet object
    count: 20,
    minRadius: Math.PI / 12, // Reduced size by 1/3
    maxRadius: Math.PI / 6, // Reduced size by 1/3
  });

  // Add large plates to the simulation
  for (const plate of largePlates) {
    await sim.addPlate(plate);
  }

  // Get all plates from the simulation (including the newly added large ones)
  const platesCollection = sim.simUniv.get('plates');
  const allPlates: SimPlateIF[] = [];

  console.log(`🔍 Getting plates from collection...`);

  // Manually iterate the async generator
  const plateGenerator = platesCollection.find(
    'planetId',
    sim.simulation.planetId,
  );
  let plateResult = await plateGenerator.next();

  while (!plateResult.done) {
    const [id, plate] = plateResult.value;
    allPlates.push(plate);

    if (allPlates.length <= 5) {
      // Only log first 5 to avoid spam
      console.log(
        `   Found plate ${allPlates.length}: ${plate.id}, radius: ${plate.radius}`,
      );
      console.log('     Plate position:', plate.position);

      // Check if position is on Earth's surface
      const positionVector = new THREE.Vector3(
        plate.position.x,
        plate.position.y,
        plate.position.z,
      );
      const distanceFromCenter = positionVector.length();
      console.log(
        '     Distance from center:',
        distanceFromCenter.toFixed(1),
        'km',
      );
      console.log(
        '     Expected Earth surface:',
        EARTH_RADIUS.toFixed(1),
        'km',
      );
      console.log(
        '     Position ratio to Earth radius:',
        (distanceFromCenter / EARTH_RADIUS).toFixed(3),
      );
    }

    // Get next plate
    plateResult = await plateGenerator.next();
  }

  // Create PlateletManager with injectable architecture
  const plateletManager = new PlateletManager(sim.universe);

  // Generate platelets for all plates using workers
  console.log('🤖 Generating platelets using workers...');
  console.time('⏱️ Platelet Generation');

  const plateIds = allPlates.map((plate) => plate.id);
  console.log('🔍 Plate IDs for platelet generation:', plateIds);

  // Wait for workers to finish initializing (they started earlier)
  console.log('⏳ Waiting for workers to finish initialization...');
  await workerInitPromise;

  // Determine optimal number of workers based on actual plate count
  const numWorkers = Math.min(maxWorkers, plateIds.length); // Don't use more workers than plates
  console.log(`🤖 Using ${numWorkers} workers for ${plateIds.length} plates`);

  console.log(
    `🤖 Worker status: ${workerManager.workers.length} workers available`,
  );
  workerManager.workers.forEach((worker, index) => {
    console.log(
      `   Worker ${index + 1}: ${worker.id}, status: ${worker.status}, tasks: ${worker.tasks.join(', ')}`,
    );
  });

  // Update worker status in UI
  const workerStatusElement = document.getElementById('worker-status');
  if (workerStatusElement) {
    const availableWorkers = workerManager.workers.filter(
      (w) => w.status === 'available',
    ).length;
    const totalWorkers = workerManager.workers.length;
    workerStatusElement.textContent = `Workers: ${availableWorkers}/${totalWorkers} available (${numWorkers} cores)`;
    workerStatusElement.style.color =
      availableWorkers > 0 ? '#4CAF50' : '#FF9800'; // Green if available, orange if not
  }

  let total = 0;

  // Create tasks for each plate (reuse planet from earlier)
  console.log(`🔧 Creating ${plateIds.length} worker tasks...`);
  const plateletTasks = plateIds.map((plateId, index) => {
    console.log(
      `📝 Creating task ${index + 1}/${plateIds.length} for plate ${plateId}`,
    );

    return new Promise<number>((resolve, reject) => {
      const task: ITaskParams = {
        name: 'generate-platelets',
        params: {
          plateId,
          planetRadius: planet.radius,
          resolution: 3, // H3 resolution for platelets
          universeId: sim.universe.name,
          dontClear: true,
        },
        onSuccess: (response: any) => {
          const { content } = response;
          const plateletCount = content?.plateletCount || 0;
          const executionTime = content?.executionTime || 0;

          console.log(`✅ Worker SUCCESS for plate ${plateId}:`, {
            plateletCount,
            executionTime: `${executionTime}ms`,
            message: content?.message,
            plateId: content?.plateId,
          });

          // Update UI with progress
          const statusElement = document.getElementById('worker-status');
          if (statusElement) {
            statusElement.textContent = `Generated ${plateletCount} platelets for plate ${plateId}`;
          }

          resolve(plateletCount);
        },
        onError: (error: any) => {
          const errorMessage =
            error.error || error.message || 'Unknown worker error';
          const errorDetails = error.errorDetails || {};

          console.error(`❌ Worker ERROR for plate ${plateId}:`, {
            error: errorMessage,
            details: errorDetails,
            plateId,
            taskId: error.taskId,
          });

          // Update UI with error
          const statusElement = document.getElementById('worker-status');
          if (statusElement) {
            statusElement.textContent = `❌ Worker failed for plate ${plateId}: ${errorMessage}`;
            statusElement.style.color = '#F44336'; // Red color for error
          }

          reject(
            new Error(`Worker failed for plate ${plateId}: ${errorMessage}`),
          );
        },
      };

      console.log(`➕ Adding task to TaskManager for plate ${plateId}`);
      const addedTask = taskManager.addTask(task);
      console.log(
        `✅ Task added with ID: ${addedTask.id} for plate ${plateId}`,
      );
    });
  });

  console.log(
    `🎯 Created ${plateletTasks.length} promises, waiting for completion...`,
  );

  // Wait for all platelet generation tasks to complete
  try {
    const results = await Promise.all(plateletTasks);
    total = results.reduce((sum, count) => sum + count, 0);
    console.log(`🎉 All workers completed! Total platelets: ${total}`);
  } catch (error) {
    console.error('❌ Worker task failed:', error);
    // Fallback to main thread generation
    console.log('🔄 Falling back to main thread generation...');
    for (const plateId of plateIds) {
      const count = await plateletManager.generatePlatelets(plateId);
      total += count;
    }
  }

  const plateletCountElement = document.getElementById('platelet-count');

  if (plateletCountElement) {
    plateletCountElement.textContent = total.toString();
  }

  await sim.populatePlateletNeighbors();
  console.timeEnd('⏱️ Neighbor Population');

  await sim.createIrregularPlateEdges();

  // Create visualizers BEFORE edge detection so they see the full platelet set
  console.time('⏱️ Visualization Creation');
  const plateVisualizers: PlateletVisualizer[] = [];

  for (const plate of allPlates) {
    // Pass scene, planetRadius, plate, and plateletManager to the constructor
    const visualizer = new PlateletVisualizer(
      scene,
      EARTH_RADIUS,
      plate,
      plateletManager,
    );

    // Create initial mesh with current platelets (before deletion)
    await visualizer.createInitialVisualization();

    // Add to scene
    visualizer.visualize();
    plateVisualizers.push(visualizer);
  }
  console.timeEnd('⏱️ Visualization Creation');

  console.log(`Created visualizers for ${plateVisualizers.length} plates.`);

  // Add axes helper
  const axesHelper = new THREE.AxesHelper(EARTH_RADIUS * 0.5); // Make axes helper relative to Earth radius
  scene.add(axesHelper);

  // Animation loop
  let frameCount = 0;
  function animate() {
    requestAnimationFrame(animate);

    // Update controls
    controls.update();

    // Update light helper (optional)
    // lightHelper.update(); // Keep this commented out unless needed

    // Update each plate visualizer
    plateVisualizers.forEach((visualizer) => {
      visualizer.update();
    });

    // Render scene
    renderer.render(scene, camera);

    // Log first few frames to verify animation is running
    frameCount++;
    if (frameCount <= 5) {
      console.log(
        `🎬 Animation frame ${frameCount}: rendered scene with ${plateVisualizers.length} visualizers`,
      );
    } else if (frameCount === 60) {
      console.log(`🎬 Animation running smoothly - rendered 60 frames`);
    }
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start animation
  console.log('🎬 Starting animation loop...');
  animate();
  console.log('🎬 Animation loop started');

  // Cleanup function for when the page is unloaded
  window.addEventListener('beforeunload', () => {
    console.log('🧹 Cleaning up workers...');
    workerManager.close();
    taskManager.close();
  });
}

// Call the async function with detailed error handling
generateAndVisualizePlatelets().catch((error) => {
  console.error('❌ Fatal error in generateAndVisualizePlatelets:', error);
  console.error('Stack trace:', error.stack);

  // Update storage info to show error
  const storageTypeElement = document.getElementById('storage-type');
  if (storageTypeElement) {
    storageTypeElement.textContent = 'Error: Failed to initialize IDBSun';
    storageTypeElement.style.color = '#F44336'; // Red color to indicate error
  }

  // Show error on screen
  document.body.innerHTML = `
    <div style="color: red; font-family: monospace; padding: 20px; background: black;">
      <h1>Visualization Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <p><strong>Storage:</strong> Failed to initialize IDBSun</p>
      <pre>${error.stack}</pre>
    </div>
  `;
});
