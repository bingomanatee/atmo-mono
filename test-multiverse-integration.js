// Test the integrated multiverse with shared storage
import { PlateSimulation } from './packages/atmo-plates/dist/index.js';

async function testMultiverseIntegration() {
  console.log('🧪 Testing Multiverse Integration with Shared Storage');
  
  try {
    // Test 1: Create master simulation with shared storage
    console.log('\n📊 Test 1: Master simulation with shared storage');
    const masterSim = new PlateSimulation({
      planetRadius: 6371,
      useSharedStorage: true, // Enable shared IndexedDB
      plateCount: 0
    });
    
    await masterSim.init();
    console.log('✅ Master simulation initialized with shared storage');
    
    // Add a test plate
    const plateId = await masterSim.addPlate({
      radius: Math.PI / 24, // Small plate
      density: 2.8,
      thickness: 35,
      planetId: masterSim.planet.id,
    });
    
    console.log(`✅ Master added plate: ${plateId}`);
    
    // Test 2: Create worker simulation with shared storage
    console.log('\n🤖 Test 2: Worker simulation with shared storage');
    const workerSim = new PlateSimulation({
      planetRadius: 6371,
      useSharedStorage: true, // Same shared IndexedDB
      plateCount: 0
    });
    
    await workerSim.init();
    console.log('✅ Worker simulation initialized with shared storage');
    
    // Test 3: Worker should see master's plate
    console.log('\n🔍 Test 3: Data sharing verification');
    const masterPlates = await masterSim.getPlates();
    const workerPlates = await workerSim.getPlates();
    
    console.log(`📊 Master sees ${masterPlates.length} plates`);
    console.log(`📊 Worker sees ${workerPlates.length} plates`);
    
    if (masterPlates.length === workerPlates.length && masterPlates.length > 0) {
      console.log('✅ SUCCESS: Both master and worker see the same data!');
      
      // Verify they're the same plate
      const masterPlate = masterPlates[0];
      const workerPlate = workerPlates[0];
      
      if (masterPlate.id === workerPlate.id) {
        console.log(`✅ SUCCESS: Same plate ID (${masterPlate.id}) in both instances!`);
      } else {
        console.log('❌ FAIL: Different plate IDs');
      }
    } else {
      console.log('❌ FAIL: Data not shared between master and worker');
    }
    
    // Test 4: Worker adds data, master should see it
    console.log('\n🔄 Test 4: Bidirectional data sharing');
    const workerPlateId = await workerSim.addPlate({
      radius: Math.PI / 32, // Even smaller plate
      density: 3.0,
      thickness: 40,
      planetId: workerSim.planet.id,
    });
    
    console.log(`✅ Worker added plate: ${workerPlateId}`);
    
    // Check if master can see worker's plate
    const updatedMasterPlates = await masterSim.getPlates();
    const updatedWorkerPlates = await workerSim.getPlates();
    
    console.log(`📊 After worker addition - Master sees ${updatedMasterPlates.length} plates`);
    console.log(`📊 After worker addition - Worker sees ${updatedWorkerPlates.length} plates`);
    
    if (updatedMasterPlates.length === updatedWorkerPlates.length && updatedMasterPlates.length === 2) {
      console.log('✅ SUCCESS: Bidirectional data sharing works!');
      console.log('🎉 MULTIVERSE SHARED STORAGE INTEGRATION COMPLETE!');
    } else {
      console.log('❌ FAIL: Bidirectional data sharing failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testMultiverseIntegration();
