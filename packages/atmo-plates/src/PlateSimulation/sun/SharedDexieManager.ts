import { AsyncSunIF, SchemaLocalIF } from '@wonderlandlabs/multiverse';
import Dexie from 'dexie';
import { log } from '../../utils/utils';

interface SharedDexieOptions {
  dbName: string;
  schemas: Record<string, SchemaLocalIF<any>>; // All table schemas
  dontClear?: boolean;
  version?: number; // Database version for schema evolution
}

/**
 * Centralized Dexie manager that handles multiple tables in a single database
 * Prevents schema conflicts by managing all tables together
 */
export class SharedDexieManager {
  private static instances: Map<string, SharedDexieManager> = new Map();
  private db: Dexie | null = null;
  private dbName: string;
  private schemas: Record<string, SchemaLocalIF<any>>;
  private dontClear: boolean;
  private version: number;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  private constructor(options: SharedDexieOptions) {
    this.dbName = options.dbName;
    this.schemas = options.schemas;
    this.dontClear = options.dontClear || false;
    this.version = options.version || 1;
  }

  /**
   * Get or create a shared Dexie manager instance
   */
  static async getInstance(
    options: SharedDexieOptions,
  ): Promise<SharedDexieManager> {
    const key = options.dbName;

    if (!this.instances.has(key)) {
      const instance = new SharedDexieManager(options);
      this.instances.set(key, instance);
      await instance.initialize();
    }

    return this.instances.get(key)!;
  }

  /**
   * Initialize the shared database with all schemas
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      // Clear database if requested
      if (!this.dontClear) {
        log(
          `🔧 SharedDexieManager: Destroying existing database (dontClear=false)`,
        );
        await this.destroyExistingDatabase();
      } else {
        log(
          `🔒 SharedDexieManager: Preserving existing database (dontClear=true)`,
        );
      }

      // Initialize Dexie database
      this.db = new Dexie(this.dbName);

      // Create stores for all schemas at once
      const stores: Record<string, string> = {};

      for (const [tableName, schema] of Object.entries(this.schemas)) {
        const indexes = this.extractIndexedFields(schema);
        const indexString = ['id', ...indexes].join(',');
        stores[tableName] = indexString;
        log(
          `🔧 SharedDexieManager: Adding table ${tableName} with indexes: ${indexString}`,
        );
      }

      // Set up all stores with proper versioning
      this.db.version(this.version).stores(stores);

      // Test database access
      await this.db.open();
      this.isInitialized = true;

      log(`✅ SharedDexieManager initialized with IndexedDB: ${this.dbName}`);
      log(`📊 Tables: ${Object.keys(stores).join(', ')}`);
    } catch (error) {
      log(`❌ SharedDexieManager initialization failed:`, error);
      this.db = null;
      throw error;
    }
  }

  /**
   * Get a table from the shared database
   */
  getTable<T>(
    tableName: string,
  ): Dexie.Table<T & { id: string }, string> | null {
    if (!this.db || !this.isInitialized) {
      throw new Error(
        `SharedDexieManager not initialized for table ${tableName}`,
      );
    }

    return this.db.table(tableName);
  }

  /**
   * Check if the manager is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Extract indexed fields from schema
   */
  private extractIndexedFields(schema: SchemaLocalIF<any>): string[] {
    const indexedFields: string[] = [];

    for (const [fieldName, field] of Object.entries(schema.fields)) {
      if (field.meta?.index === true) {
        indexedFields.push(fieldName);
      }
    }

    return indexedFields;
  }

  /**
   * Destroy existing database
   */
  private async destroyExistingDatabase(): Promise<void> {
    try {
      const databases = await indexedDB.databases();
      const existingDb = databases.find((db) => db.name === this.dbName);

      if (existingDb) {
        log(`🗑️ Destroying existing database: ${this.dbName}`);

        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(this.dbName);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            log(`⚠️ Database deletion blocked: ${this.dbName}`);
            resolve(); // Continue anyway
          };
        });

        log(`✅ Database destroyed: ${this.dbName}`);
      }
    } catch (error) {
      log(`⚠️ Failed to destroy existing database ${this.dbName}:`, error);
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Clear all instances (for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}
