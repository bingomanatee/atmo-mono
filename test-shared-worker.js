// Import Dexie in worker
importScripts('https://unpkg.com/dexie@3.2.4/dist/dexie.min.js');

class SharedDexieManager {
    constructor(dbName, schemas, dontClear = true) { // Workers default to dontClear=true
        this.dbName = dbName;
        this.schemas = schemas;
        this.dontClear = dontClear;
        this.db = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Workers should NOT clear the database - they connect to existing
            if (!this.dontClear) {
                console.log('🔧 Worker: Destroying existing database (unusual for worker)');
                await this.destroyDatabase();
            } else {
                console.log('🔒 Worker: Connecting to existing database');
            }

            // Initialize Dexie
            this.db = new Dexie(this.dbName);

            // Create stores for all schemas (same as master)
            const stores = {};
            for (const [tableName, schema] of Object.entries(this.schemas)) {
                const indexes = this.extractIndexes(schema);
                const indexString = ['id', ...indexes].join(',');
                stores[tableName] = indexString;
                console.log(`🔧 Worker: Adding table ${tableName} with indexes: ${indexString}`);
            }

            // Set up all stores in a single version
            this.db.version(1).stores(stores);
            await this.db.open();

            this.isInitialized = true;
            console.log(`✅ Worker: SharedDexieManager initialized: ${this.dbName}`);
            console.log(`📊 Worker: Tables: ${Object.keys(stores).join(', ')}`);
        } catch (error) {
            console.error('❌ Worker: SharedDexieManager initialization failed:', error);
            throw error;
        }
    }

    extractIndexes(schema) {
        const indexes = [];
        for (const [fieldName, field] of Object.entries(schema.fields)) {
            if (field.meta?.index === true) {
                indexes.push(fieldName);
            }
        }
        return indexes;
    }

    async destroyDatabase() {
        try {
            const databases = await indexedDB.databases();
            const existingDb = databases.find(db => db.name === this.dbName);
            
            if (existingDb) {
                await new Promise((resolve, reject) => {
                    const deleteRequest = indexedDB.deleteDatabase(this.dbName);
                    deleteRequest.onsuccess = () => resolve();
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                    deleteRequest.onblocked = () => {
                        console.warn('⚠️ Worker: Database deletion blocked');
                        resolve(); // Continue anyway
                    };
                });
                console.log(`✅ Worker: Database destroyed: ${this.dbName}`);
            }
        } catch (error) {
            console.warn('⚠️ Worker: Failed to destroy database:', error);
        }
    }

    getTable(tableName) {
        if (!this.isInitialized || !this.db) {
            throw new Error(`Worker: Database not initialized for table ${tableName}`);
        }
        return this.db.table(tableName);
    }
}

// Worker instance
let manager;
let isWorker = true; // This is a worker

// Worker message handler
self.onmessage = async function(e) {
    const { command, schemas } = e.data;
    
    try {
        switch (command) {
            case 'init':
                await initWorker(schemas);
                break;
            case 'add-foo':
                await addFoo(e.data.data);
                break;
            case 'add-bar':
                await addBar(e.data.data);
                break;
            case 'list-all':
                await listAll();
                break;
            default:
                console.warn('🤷 Worker: Unknown command:', command);
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

async function initWorker(schemas) {
    try {
        self.postMessage({ type: 'status', message: 'Initializing...' });
        
        manager = new SharedDexieManager('test-shared-db', schemas, true); // dontClear=true for worker
        await manager.initialize();
        
        self.postMessage({ type: 'status', message: 'Ready ✅' });
        console.log('🎯 Worker initialized successfully');
        
        // Demonstrate worker can access existing data
        await listAll();
        
        // Add some worker-generated data
        setTimeout(() => addWorkerData(), 2000);
        
    } catch (error) {
        self.postMessage({ type: 'status', message: `Error - ${error.message}` });
        console.error('❌ Worker initialization failed:', error);
    }
}

async function addFoo(data = null) {
    try {
        const fooTable = manager.getTable('foo');
        const foo = data || {
            id: `worker_foo_${Date.now()}`,
            name: `Worker Foo ${Math.floor(Math.random() * 100)}`,
            value: Math.floor(Math.random() * 1000),
            timestamp: Date.now()
        };
        await fooTable.put(foo);
        console.log('✅ Worker: Added foo:', foo);
        
        self.postMessage({
            type: 'data-added',
            table: 'foo',
            data: foo
        });
    } catch (error) {
        console.error('❌ Worker: Failed to add foo:', error);
        throw error;
    }
}

async function addBar(data = null) {
    try {
        const barTable = manager.getTable('bar');
        const bar = data || {
            id: `worker_bar_${Date.now()}`,
            title: `Worker Bar ${Math.floor(Math.random() * 100)}`,
            count: Math.floor(Math.random() * 50),
            active: Math.random() > 0.5
        };
        await barTable.put(bar);
        console.log('✅ Worker: Added bar:', bar);
        
        self.postMessage({
            type: 'data-added',
            table: 'bar',
            data: bar
        });
    } catch (error) {
        console.error('❌ Worker: Failed to add bar:', error);
        throw error;
    }
}

async function listAll() {
    try {
        const fooTable = manager.getTable('foo');
        const barTable = manager.getTable('bar');
        
        const foos = await fooTable.toArray();
        const bars = await barTable.toArray();
        
        console.log(`📊 Worker: Database contents - Foos: ${foos.length}, Bars: ${bars.length}`);
        
        self.postMessage({
            type: 'data-list',
            foos,
            bars
        });
    } catch (error) {
        console.error('❌ Worker: Failed to list data:', error);
        throw error;
    }
}

async function addWorkerData() {
    console.log('🤖 Worker: Adding automatic data...');
    await addFoo();
    setTimeout(() => addBar(), 1000);
}

console.log('🔧 Worker script loaded and ready');
