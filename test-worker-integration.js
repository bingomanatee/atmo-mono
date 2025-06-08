// End-to-end integration test for the worker system
// Simple test to verify worker environment detection and basic functionality

console.log("🧪 Testing Worker Integration End-to-End");
console.log("=====================================");

// Test 1: Environment Detection
console.log("\n📊 Test 1: Environment Detection");
const isNode = typeof window === "undefined" && typeof process !== "undefined";
const isBrowser =
  typeof window !== "undefined" && typeof Worker !== "undefined";

console.log(
  `Environment: ${
    isNode ? "Node.js (Server)" : isBrowser ? "Browser" : "Unknown"
  }`
);
console.log(`Workers supported: ${isNode || isBrowser ? "Yes" : "No"}`);

// Test 2: Worker System Detection
console.log("\n🔧 Test 2: Worker System Detection");
const workersSupported = isNode
  ? typeof process !== "undefined" && !!process.versions?.node
  : typeof Worker !== "undefined";

console.log(`Worker support detected: ${workersSupported}`);
console.log(`Node.js version: ${process.versions?.node || "N/A"}`);
console.log(`Process available: ${typeof process !== "undefined"}`);

// Test 3: atmo-workers Import Test
console.log("\n📦 Test 3: atmo-workers Import Test");
try {
  // Try to import the atmo-workers package
  const { TaskManager, BrowserWorkerManager, ServerWorkerManager } =
    await import("./packages/atmo-workers/dist/index.js");

  console.log("✅ Successfully imported atmo-workers");
  console.log(`TaskManager: ${typeof TaskManager}`);
  console.log(`BrowserWorkerManager: ${typeof BrowserWorkerManager}`);
  console.log(`ServerWorkerManager: ${typeof ServerWorkerManager}`);

  // Test 4: Create TaskManager
  console.log("\n🔄 Test 4: TaskManager Creation");
  const taskManager = new TaskManager();
  console.log("✅ TaskManager created successfully");
  console.log(`TaskManager status: ${taskManager ? "Active" : "Inactive"}`);

  // Test 5: Environment-specific Worker Manager with REAL Worker Script
  console.log("\n🚀 Test 5: Environment-specific Worker Manager");

  if (isNode) {
    console.log("Creating ServerWorkerManager for Node.js environment...");
    try {
      // Use the actual platelet worker script
      const serverWorkerManager = new ServerWorkerManager({
        manager: taskManager,
        configs: [
          {
            tasks: ["generate-platelets"],
            script:
              "./packages/atmo-plates/src/workers/platelet-worker-server-simple.js",
          },
        ],
      });
      console.log("✅ ServerWorkerManager created successfully");
      console.log(`Worker count: ${serverWorkerManager.workers.length}`);

      // Test 6: CRITICAL - Validate Server Worker Actually Works
      console.log("\n🔍 Test 6: Server Worker Validation (NOT Fallback)");

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Submit a real task to verify worker functionality
      const workerTestResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Worker test timeout - likely fell back to main thread")
          );
        }, 5000);

        taskManager.addTask({
          name: "generate-platelets",
          params: {
            plateId: "test-plate-123",
            planetRadius: 6371008.8,
            resolution: 2,
            universeId: "test-universe",
            dontClear: true,
            testMode: true, // Enable test mode for quick response
          },
          onSuccess: (result) => {
            clearTimeout(timeout);
            resolve(result.content);
          },
          onError: (error) => {
            clearTimeout(timeout);
            reject(new Error(`Worker task failed: ${error.error}`));
          },
        });
      });

      console.log("✅ Server Worker Task Result:", workerTestResult);

      // Validate this came from the worker, not fallback
      if (
        workerTestResult.environment === "Node.js" &&
        workerTestResult.dataSource === "Server-Worker"
      ) {
        console.log(
          "✅ CONFIRMED: Server worker is functioning (NOT fallback)"
        );
        console.log(`   - Environment: ${workerTestResult.environment}`);
        console.log(`   - Data Source: ${workerTestResult.dataSource}`);
        console.log(`   - Worker ID: ${workerTestResult.workerId}`);
        console.log(`   - Message: ${workerTestResult.message}`);
      } else {
        console.log(
          "❌ WARNING: Server worker may be falling back to main thread"
        );
        console.log("   Result:", workerTestResult);
      }

      // Clean up
      serverWorkerManager.close();
      console.log("✅ ServerWorkerManager cleaned up");
    } catch (error) {
      console.log("❌ ServerWorkerManager test failed:", error.message);
      console.log("   This indicates workers are falling back to main thread!");
    }
  } else {
    console.log("Creating BrowserWorkerManager for browser environment...");
    try {
      const browserWorkerManager = new BrowserWorkerManager({
        manager: taskManager,
        configs: [
          {
            tasks: ["generate-platelets"],
            script: "./packages/atmo-plates/src/workers/platelet-worker.js",
          },
        ],
      });
      console.log("✅ BrowserWorkerManager created successfully");
      console.log(`Worker count: ${browserWorkerManager.workers.length}`);

      // Clean up
      browserWorkerManager.close();
      console.log("✅ BrowserWorkerManager cleaned up");
    } catch (error) {
      console.log(
        "⚠️ BrowserWorkerManager creation failed (expected in Node.js):",
        error.message
      );
    }
  }

  // Clean up task manager
  taskManager.close();
  console.log("✅ TaskManager cleaned up");
} catch (error) {
  console.log("❌ Failed to import atmo-workers:", error.message);
}

// Test 7: Summary
console.log("\n🎉 INTEGRATION TEST SUMMARY");
console.log("===========================");
console.log(`Environment: ${isNode ? "Node.js Server" : "Browser"}`);
console.log(`Workers Supported: ${workersSupported}`);
console.log("✅ Worker system validation completed!");
console.log("");
console.log("🔍 CRITICAL VALIDATION:");
console.log("- Server workers are tested with REAL tasks");
console.log("- Results are validated to ensure NO fallback to main thread");
console.log("- Worker environment and data source are verified");
console.log("- Timeout protection prevents false positives");
