// Worker Engine + IDBSun Proof of Concept - Worker Side
import { Multiverse, CollAsync, SchemaLocal, FIELD_TYPES } from './packages/multiverse/dist/index.js';
import { createIDBSun } from './packages/atmo-plates/dist/index.js';

// Same schema as master
const dataSchema = new SchemaLocal('testData', {
    id: FIELD_TYPES.string,
    value: { ...FIELD_TYPES.number, meta: { index: true } },
    source: { ...FIELD_TYPES.string, meta: { index: true } },
    timestamp: { ...FIELD_TYPES.number, meta: { index: true } },
    processed: { ...FIELD_TYPES.boolean, meta: { index: true } },
    processingResult: FIELD_TYPES.number
});

// Worker state
let workerMultiverse;
let workerDataCollection;
let isInitialized = false;

// Worker message handler
self.onmessage = async function(e) {
    const { command } = e.data;
    
    try {
        switch (command) {
            case 'init':
                await initWorker();
                break;
            case 'add-data':
                await addWorkerData();
                break;
            case 'process-data':
                await processUnprocessedData();
                break;
            default:
                console.warn('🤖 Worker: Unknown command:', command);
        }
    } catch (error) {
        console.error('❌ Worker: Command failed:', error);
        self.postMessage({
            type: 'error',
            message: error.message,
            command
        });
    }
};

async function initWorker() {
    try {
        self.postMessage({
            type: 'status',
            message: 'Connecting to IDBSun...'
        });

        // Create multiverse
        workerMultiverse = new Multiverse();
        
        // Create IDBSun for worker (connects to existing schema)
        const dataSun = await createIDBSun({
            dbName: 'worker-engine-poc',
            tableName: 'testData',
            schema: dataSchema,
            isMaster: false // Worker connects to existing schema
        });

        console.log('✅ Worker: IDBSun connected');
        console.log('📊 Worker: Storage info:', dataSun.getStorageInfo());

        // Create universe and collection
        const universe = workerMultiverse.add({ name: 'poc' });
        
        workerDataCollection = new CollAsync({
            name: 'testData',
            universe,
            schema: dataSchema,
            sun: dataSun
        });

        universe.add(workerDataCollection);
        
        isInitialized = true;
        
        self.postMessage({
            type: 'status',
            message: 'Connected! 🤖',
            success: true
        });
        
        console.log('🤖 Worker: Ready to process data via IDBSun');
        
        // Report current data count
        await reportDataStatus();
        
        // Start autonomous processing
        setTimeout(() => autonomousProcessing(), 3000);
        
    } catch (error) {
        self.postMessage({
            type: 'status',
            message: `Connection failed - ${error.message}`
        });
        console.error('❌ Worker initialization failed:', error);
    }
}

async function addWorkerData() {
    if (!isInitialized) {
        throw new Error('Worker not initialized');
    }
    
    const item = {
        id: `worker_${Date.now()}`,
        value: Math.floor(Math.random() * 100),
        source: 'worker',
        timestamp: Date.now(),
        processed: false,
        processingResult: 0
    };
    
    await workerDataCollection.set(item.id, item);
    console.log('🤖 Worker: Added data via IDBSun:', item);
    
    self.postMessage({
        type: 'data-changed',
        action: 'added',
        item: item
    });
}

async function processUnprocessedData() {
    if (!isInitialized) {
        throw new Error('Worker not initialized');
    }
    
    // Find unprocessed data
    const unprocessedItems = [];
    for await (const item of workerDataCollection.find({ processed: false })) {
        unprocessedItems.push(item);
    }
    
    console.log(`🤖 Worker: Found ${unprocessedItems.length} unprocessed items`);
    
    for (const item of unprocessedItems) {
        // Simulate processing (square the value)
        const processingResult = item.value * item.value;
        
        // Update the item
        const updatedItem = {
            ...item,
            processed: true,
            processingResult: processingResult
        };
        
        await workerDataCollection.set(item.id, updatedItem);
        console.log(`⚙️ Worker: Processed ${item.id}: ${item.value}² = ${processingResult}`);
    }
    
    if (unprocessedItems.length > 0) {
        self.postMessage({
            type: 'data-changed',
            action: 'processed',
            count: unprocessedItems.length
        });
    }
}

async function reportDataStatus() {
    if (!isInitialized) return;
    
    const allItems = [];
    for await (const item of workerDataCollection.find()) {
        allItems.push(item);
    }
    
    const processedCount = allItems.filter(item => item.processed).length;
    const unprocessedCount = allItems.filter(item => !item.processed).length;
    
    console.log(`📊 Worker: Data status - Total: ${allItems.length}, Processed: ${processedCount}, Unprocessed: ${unprocessedCount}`);
}

async function autonomousProcessing() {
    if (!isInitialized) return;
    
    console.log('🔄 Worker: Starting autonomous processing...');
    
    // Process data every 10 seconds
    setInterval(async () => {
        try {
            const unprocessedItems = [];
            for await (const item of workerDataCollection.find({ processed: false })) {
                unprocessedItems.push(item);
            }
            
            if (unprocessedItems.length > 0) {
                console.log(`🔄 Worker: Auto-processing ${unprocessedItems.length} items...`);
                await processUnprocessedData();
            }
        } catch (error) {
            console.error('❌ Worker: Autonomous processing failed:', error);
        }
    }, 10000);
    
    // Add random data every 15 seconds
    setInterval(async () => {
        try {
            if (Math.random() > 0.7) { // 30% chance
                console.log('🎲 Worker: Auto-generating data...');
                await addWorkerData();
            }
        } catch (error) {
            console.error('❌ Worker: Auto data generation failed:', error);
        }
    }, 15000);
}

console.log('🤖 Worker: Script loaded and ready');
