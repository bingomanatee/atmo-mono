# Suns in Multiverse

## Overview

In the Multiverse system, a "Sun" is the data access layer that interfaces with
a specific storage technology. Suns are responsible for the actual data
operations (create, read, update, delete) and abstract away the details of the
underlying storage mechanism.

Just as planets orbit around a sun in a solar system, collections in a Universe
orbit around a Sun that provides their data persistence capabilities.

## Sun API

A Sun implementation must provide a standardized interface for collections to
interact with. This allows collections to work with different storage
technologies without changing their code.

### Sun Types

Multiverse supports two types of Suns with different return value patterns:

1. **Async Suns**: Return Promises for all operations

   - Used for asynchronous storage systems (IndexedDB, REST APIs, etc.)
   - Methods return `Promise<T>`, `Promise<void>`, etc.
   - Used with `CollAsync` collections

2. **Sync Suns**: Return values directly for all operations
   - Used for synchronous storage systems (Memory, LocalStorage, etc.)
   - Methods return `T`, `void`, etc. directly without Promises
   - Used with `CollSync` collections

The examples below show the Async Sun interface. For Sync Suns, simply remove
the Promise wrappers from the return types.

### Required Methods

| Method   | Description                      | Parameters              | Async Return Value        | Sync Return Value |
| -------- | -------------------------------- | ----------------------- | ------------------------- | ----------------- |
| `get`    | Retrieves a single record by key | `key: string`           | `Promise<T \| undefined>` | `T \| undefined`  |
| `set`    | Creates or updates a record      | `key: string, value: T` | `Promise<void>`           | `void`            |
| `delete` | Removes a record                 | `key: string`           | `Promise<void>`           | `void`            |
| `clear`  | Removes all records              | None                    | `Promise<void>`           | `void`            |

### Optional Methods

| Method    | Description                          | Parameters                | Async Return Value               | Sync Return Value           |
| --------- | ------------------------------------ | ------------------------- | -------------------------------- | --------------------------- |
| `find`    | Queries for records                  | `query?: any`             | `AsyncGenerator<Map<string, T>>` | `Generator<Map<string, T>>` |
| `getMany` | Retrieves multiple records by keys   | `keys: string[]`          | `AsyncGenerator<Map<string, T>>` | `Generator<Map<string, T>>` |
| `getAll`  | Retrieves all records                | None                      | `AsyncGenerator<Map<string, T>>` | `Generator<Map<string, T>>` |
| `setMany` | Creates or updates multiple records  | `entries: Map<string, T>` | `Promise<void>`                  | `void`                      |
| `count`   | Counts records (optionally filtered) | `query?: any`             | `Promise<number>`                | `number`                    |

> **Note on generators**: Methods like `find`, `getMany`, and `getAll` return generators that
> yield Maps of key-value pairs, not individual entries. This allows breaking up large flows
> of data into batches without requiring the process to be asynchronous. The generator pattern
> is memory-efficient as it allows processing batches of records rather than loading everything
> into memory at once. For large datasets, data may come across in multiple Maps that can be
> assembled using the `deGenerateMaps` utility function provided by the Multiverse system.

> **Note on find parameters**: There is no fixed API for the parameters in the `find` method.
> The included Sun implementations typically support:
>
> - Two discrete parameters: `find(key, value)` - where key and value are separate arguments
> - Single object parameter: `find({key: 'value'})` - for key-based filtering
> - Single object parameter: `find({value: {prop: 'value'}})` - for value-based filtering
>
> The existing Sun implementations expect one or two arguments for their find methods.
> However, custom Sun implementations may have different search mechanisms based on their
> underlying storage technology. The `find` method can take any number of parameters and
> pass them along to the sun, but don't assume all query patterns will work in all suns.
> Always refer to the specific Sun implementation's documentation for supported query formats.

### Sun Implementation Types

Suns can be implemented in different ways depending on the requirements:

1. **Local Cache Suns**: Maintain a local copy of data (e.g., MemorySun)
2. **Passthrough Suns**: Directly access external resources without local caching (e.g., RESTSun)
3. **Hybrid Suns**: Combine local caching with external persistence

## Creating a Custom Sun

### Basic Sun Templates

#### Async Sun Template

```typescript
import { AsyncSunIF } from '@atmo/multiverse';

export class CustomAsyncSun<T> implements AsyncSunIF<T> {
  constructor(options: CustomSunOptions) {
    // Initialize your sun
  }

  async get(key: string): Promise<T | undefined> {
    // Implement get logic
  }

  async set(key: string, value: T): Promise<void> {
    // Implement set logic
  }

  async delete(key: string): Promise<void> {
    // Implement delete logic
  }

  async clear(): Promise<void> {
    // Implement clear logic
  }

  // Optional methods...
  async *find(query?: any): AsyncGenerator<[string, T]> {
    // Implement find logic
  }
}
```

#### Sync Sun Template

```typescript
import { SyncSunIF } from '@atmo/multiverse';

export class CustomSyncSun<T> implements SyncSunIF<T> {
  constructor(options: CustomSunOptions) {
    // Initialize your sun
  }

  get(key: string): T | undefined {
    // Implement get logic
  }

  set(key: string, value: T): void {
    // Implement set logic
  }

  delete(key: string): void {
    // Implement delete logic
  }

  clear(): void {
    // Implement clear logic
  }

  // Optional methods...
  *find(query?: any): Generator<[string, T]> {
    // Implement find logic
  }
}
```

## How To: Create an IndexedDB Sun using Dexie

This example shows how to implement an Async Sun that uses Dexie.js to interact with
IndexedDB. IndexedDB is inherently asynchronous, so we'll implement the AsyncSunIF interface.

### Step 1: Install Dependencies

```bash
npm install dexie
```

### Step 2: Implement the DexieSun

```typescript
import { AsyncSunIF } from '@atmo/multiverse';
import Dexie from 'dexie';

interface DexieSunOptions {
  dbName: string;
  tableName: string;
}

export class DexieSun<T extends object> implements AsyncSunIF<T> {
  private db: Dexie;
  private table: Dexie.Table<T & { id: string }, string>;
  private tableName: string;

  constructor(options: DexieSunOptions) {
    this.tableName = options.tableName;

    // Initialize Dexie database
    this.db = new Dexie(options.dbName);
    this.db.version(1).stores({
      [this.tableName]: 'id',
    });

    this.table = this.db.table(this.tableName);
  }

  // Required methods

  async get(key: string): Promise<T | undefined> {
    try {
      const result = await this.table.get(key);
      if (!result) return undefined;

      // Return the whole result including the id
      return result as T;
    } catch (error) {
      console.error('DexieSun get error:', error);
      throw error;
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      // Add id property for Dexie
      const record = { ...value, id: key };
      await this.table.put(record);
    } catch (error) {
      console.error('DexieSun set error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.table.delete(key);
    } catch (error) {
      console.error('DexieSun delete error:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.table.clear();
    } catch (error) {
      console.error('DexieSun clear error:', error);
      throw error;
    }
  }

  // Optional methods

  async *find(query?: any): AsyncGenerator<Map<string, T>> {
    try {
      let collection = this.table.toCollection();

      // Apply filters if query is provided
      if (query) {
        // This is a simple implementation - you might want to expand this
        // to support more complex queries
        if (query.where) {
          for (const [key, value] of Object.entries(query.where)) {
            collection = collection.filter((item) => item[key] === value);
          }
        }
      }

      const items = await collection.toArray();
      const batchSize = 30; // Send new maps every 30 records

      // Process items in batches of 30
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const resultMap = new Map<string, T>();

        for (const item of batch) {
          resultMap.set(item.id, item as unknown as T);
        }

        // Yield a map for each batch of 30 records
        yield resultMap;
      }
    } catch (error) {
      console.error('DexieSun find error:', error);
      throw error;
    }
  }

  async getMany(keys: string[]): Promise<Map<string, T>> {
    try {
      const results = await this.table.bulkGet(keys);
      const map = new Map<string, T>();

      results.forEach((result, index) => {
        if (result) {
          const { id, ...data } = result;
          map.set(keys[index], data as unknown as T);
        }
      });

      return map;
    } catch (error) {
      console.error('DexieSun getMany error:', error);
      throw error;
    }
  }

  async getAll(): Promise<Map<string, T>> {
    try {
      const results = await this.table.toArray();
      const map = new Map<string, T>();

      results.forEach((result) => {
        const { id, ...data } = result;
        map.set(id, data as unknown as T);
      });

      return map;
    } catch (error) {
      console.error('DexieSun getAll error:', error);
      throw error;
    }
  }

  async setMany(entries: Map<string, T>): Promise<void> {
    try {
      const items = Array.from(entries.entries());
      const records = items.map(([key, value]) => ({ ...value, id: key }));
      await this.table.bulkPut(records);
    } catch (error) {
      console.error('DexieSun setMany error:', error);
      throw error;
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    try {
      await this.table.bulkDelete(keys);
    } catch (error) {
      console.error('DexieSun deleteMany error:', error);
      throw error;
    }
  }

  async count(query?: any): Promise<number> {
    try {
      if (!query) {
        return await this.table.count();
      }

      // Simple implementation of query filtering
      let count = 0;
      for await (const _ of this.find(query)) {
        count++;
      }
      return count;
    } catch (error) {
      console.error('DexieSun count error:', error);
      throw error;
    }
  }
}
```

### Step 3: Usage Example

```typescript
import {
  Universe,
  Multiverse,
  CollAsync,
  FIELD_TYPES,
  SchemaLocal,
} from '@atmo/multiverse';
import { DexieSun } from './DexieSun';

// Create a schema
const userSchema = new SchemaLocal('users', {
  id: FIELD_TYPES.string,
  name: FIELD_TYPES.string,
  email: FIELD_TYPES.string,
});

// Create a multiverse instance
const multiverse = new Multiverse();

// Register the schema
multiverse.baseSchemas.set('users', userSchema);

// Create a universe with the DexieSun
const universe = new Universe('client', multiverse);
const usersSun = new DexieSun<User>({
  dbName: 'myApp',
  tableName: 'users',
});

// Create a collection using the sun
const usersCollection = new CollAsync({
  name: 'users',
  universe,
  schema: userSchema,
  sun: usersSun,
});

// Now you can use the collection with IndexedDB backing
await usersCollection.set('user1', {
  id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
});

const user = await usersCollection.get('user1');
console.log(user); // { id: 'user1', name: 'John Doe', email: 'john@example.com' }
```

## Best Practices

1. **Error Handling**: Always include proper error handling in Sun implementations
2. **Transactions**: Use transactions when performing multiple operations for consistency
3. **Caching Strategy**: Consider implementing a caching strategy for remote Suns
4. **Query Optimization**: Optimize query handling for better performance
5. **Batch Operations**: Implement batch operations (getMany, setMany) efficiently

## Common Pitfalls

1. **Forgetting to handle undefined**: The `get` method should return `undefined` for missing records
2. **Incorrect AsyncGenerator implementation**: The `find` method must return an AsyncGenerator
3. **Not handling query parameters**: The `find` method should properly handle query parameters
4. **Ignoring error handling**: Always catch and handle errors appropriately
5. **Inefficient batch operations**: Implement batch operations efficiently rather than as loops of single operations
