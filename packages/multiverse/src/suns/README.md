# Multiverse Suns

Suns are the storage engines for Multiverse collections. They handle the actual data storage and retrieval operations for collections.

## Available Sun Implementations

### SunMemory

A simple in-memory storage engine for synchronous collections.

```typescript
import { memorySunF } from '@wonderlandlabs/multiverse';

const coll = new CollSync({
  name: 'users',
  schema,
  universe,
  sunF: memorySunF, // This is the default, so it's optional
});
```

### SunMemoryAsync

An asynchronous version of the memory storage engine.

```typescript
import { memoryAsyncSunF } from '@wonderlandlabs/multiverse';

const coll = new CollAsync({
  name: 'users',
  schema,
  universe,
  sunF: memoryAsyncSunF, // This is the default for async collections
});
```

### SunMemoryImmer

An in-memory storage engine that uses a simple deep clone approach for immutable updates. This Sun implementation adds a `mutate` method that allows you to update records using a mutation function.

```typescript
import { memoryImmerSunF, MUTATION_ACTIONS } from '@wonderlandlabs/multiverse';

const coll = new CollSync({
  name: 'users',
  schema,
  universe,
  sunF: memoryImmerSunF,
});

// Use the mutate method to update a record
coll.mutate('user1', (draft, collection) => {
  if (draft) {
    // Update an existing record
    draft.name = 'New Name';
    draft.age = 30;

    // You can also modify nested objects
    if (draft.address) {
      draft.address.city = 'New City';
    }

    // And arrays
    if (draft.tags) {
      draft.tags.push('new-tag');
    }
  } else {
    // Create a new record if it doesn't exist
    return {
      id: 'user1',
      name: 'New User',
      age: 25,
    };
  }
});

// Delete a record using the DELETE action
coll.mutate('user2', (draft) => {
  if (draft) {
    // You only need to return the action and the key
    // The key can be extracted from the draft record if needed
    return { action: MUTATION_ACTIONS.DELETE, key: draft.id };
  }
});

// Do nothing with NOOP action
coll.mutate('user3', (draft) => {
  if (draft && draft.status === 'locked') {
    return { action: MUTATION_ACTIONS.NOOP };
  }
  // Otherwise proceed with normal updates
  return draft;
});

// Handling async operations in mutate
coll.mutate('user4', async (draft, collection) => {
  if (draft) {
    // Perform async operation
    const userData = await fetchUserData(draft.id);

    // Update draft with fetched data
    draft.name = userData.name;
    draft.email = userData.email;

    return draft;
  }
});
```

#### Key Features of `mutate`

> **Note**: The primary utility of the `mutate` API is taking in a draft record and returning a new version of an existing (or a new) record for a given key. This core functionality is required of all collections. Special actions, locking, and event queues may not be implemented by all engines, as these are implementation details that can vary.

1. **Record Creation**: If the record doesn't exist (draft is undefined), you can return a new record to create it.

2. **Special Actions** (implementation-dependent):

   - `{ action: MUTATION_ACTIONS.DELETE, key: key }`: Deletes the record with the specified key.
   - `{ action: MUTATION_ACTIONS.NOOP }`: Does nothing, skipping any set operations.

3. **Collection Access**: The mutation function receives the collection as a second argument, allowing access to other records or collection methods.

4. **Async Support**: If the mutation function returns a Promise-like object, the result is processed asynchronously.

5. **Locking** (implementation-dependent): During synchronous mutations, the collection may be locked to prevent concurrent set or delete operations, enforcing pure behavior in mutation functions.

6. **Event Queue** (implementation-dependent): Actions may be processed through an event queue that handles events in the next event loop cycle, ensuring proper sequencing of operations.

## Collection Query API

In addition to the basic CRUD operations, collections also provide a query API for finding records:

```typescript
// Find records by object query
const activeUsers = coll.find({ status: 'active' });

// Find records by function predicate
const olderUsers = coll.find((user) => user.age > 30);

// Find records with multiple criteria
const activeOlderUsers = coll.find(
  (user) => user.status === 'active' && user.age > 30,
);
```

> **Note**: The `find` method is engine-dependent. If the underlying engine does not implement the `find` method, an error will be thrown. The implementation details of the `find` method may vary between engines.

#### Implementation Details

```typescript
// Simplified implementation of mutate in CollSync
mutate(key: KeyType, mutator: (draft: RecordType | undefined, collection: CollSync<RecordType, KeyType>) => RecordType | void | Promise<RecordType | void> | MutationAction): RecordType | undefined {
  // Lock the collection during mutation
  this.#locked = true;

  // Event queue using RxJS Subject
  this.#event$ = new Subject<() => void>();

  // Subscribe to the event subject to process events
  this.#event$.subscribe(event => {
    // Use delay to ensure events are processed in the next tick
    delay(() => {
      // Execute the event
      event();
    });
  });

  try {
    const existing = this.get(key);

    // Create a deep clone of the existing record
    const draft = existing ? JSON.parse(JSON.stringify(existing)) : undefined;

    // Execute the mutator function
    const result = mutator(draft, this);

    // Handle Promise-like result
    if (isPromiseLike(result)) {
      // Unlock the collection immediately for async operations
      this.#locked = false;

      // Process the promise result asynchronously without locking
      result.then(asyncResult => {
        this.#afterMutate(key, asyncResult);
      });

      // Return the current value
      return this.get(key);
    }

    // Process the result
    return this.#afterMutate(key, result);
  } finally {
    // Unlock the collection
    this.#locked = false;
  }
}

// Process mutation result
#afterMutate(key: KeyType, result: RecordType | void | MutationAction): RecordType | undefined {
  // Handle special actions
  if (result && typeof result === 'object' && 'action' in result) {
    // Queue the action to be processed after unlocking
    this.#event$.next(() => {
      if (result.action === MUTATION_ACTIONS.DELETE) {
        if (result.key !== undefined) {
          this.delete(result.key);
        }
      }
      // NOOP action does nothing
    });

    if (result.action === MUTATION_ACTIONS.DELETE) {
      return undefined;
    }
    if (result.action === MUTATION_ACTIONS.NOOP) {
      return this.get(key);
    }
  }

  // Set the result if it's not undefined
  if (result !== undefined) {
    // Queue the set operation to be processed after unlocking
    this.#event$.next(() => {
      this.set(key, result as RecordType);
    });
  }

  return this.get(key);
}

// Type guard for Promise-like objects
function isPromiseLike(value: unknown): value is PromiseLike<any> {
  return value !== null &&
         typeof value === 'object' &&
         'then' in (value as object) &&
         typeof (value as any).then === 'function';
}
```

### SunMemoryImmerAsync

An asynchronous version of the SunMemoryImmer engine.

```typescript
import { memoryImmerAsyncSunF } from '@wonderlandlabs/multiverse';

const coll = new CollAsync({
  name: 'users',
  schema,
  universe,
  sunF: memoryImmerAsyncSunF,
});

// Use the mutate method to update a record (returns a Promise)
await coll.mutate('user1', (draft) => {
  if (draft) {
    draft.name = 'New Name';
  }
});
```

## Using the `mutate` Method with Class Instances

The `mutate` method is particularly useful when working with class instances that need to be stored in a collection. You can use a schema filter to convert between plain objects and class instances:

```typescript
class User {
  id: string;
  name: string;

  constructor(data: { id: string; name: string }) {
    this.id = data.id;
    this.name = data.name;
  }

  greet() {
    return `Hello, ${this.name}!`;
  }

  // Convert to a plain object for storage
  toJSON() {
    return {
      id: this.id,
      name: this.name,
    };
  }

  // Create a User from a plain object
  static fromJSON(data: any): User {
    return new User(data);
  }
}

// Custom schema filter to convert between User and plain objects
function userFilter(params: any) {
  const { inputRecord } = params;

  // If input is a User instance, convert to plain object
  if (inputRecord instanceof User) {
    return inputRecord.toJSON();
  }

  // If input is a plain object, convert to User
  return User.fromJSON(inputRecord);
}

// Create a schema with the filter
const schema = new SchemaLocal(
  'users',
  {
    id: { type: FIELD_TYPES.string },
    name: { type: FIELD_TYPES.string },
  },
  userFilter,
);

// Create a collection with the Immer Sun
const coll = new CollSync({
  name: 'users',
  schema,
  universe,
  sunF: memoryImmerSunF,
});

// Store a User instance
const user = new User({ id: 'user1', name: 'John' });
coll.set('user1', user);

// Mutate the User
coll.mutate('user1', (draft) => {
  if (draft) {
    // Since draft is a plain object, convert it back to a User
    const userObj = User.fromJSON(draft);

    // Update the User
    userObj.name = 'Jane';

    // Return the updated User
    return userObj;
  }
});

// Get the updated User
const updatedUser = coll.get('user1');
console.log(updatedUser.greet()); // "Hello, Jane!"
```

## Creating Custom Sun Implementations

### Extending Existing Suns

The `SunMemory` and `SunMemoryAsync` classes can serve as base classes for more sophisticated storage implementations. You can extend them to add additional functionality while leveraging their existing implementation:

```typescript
import { SunMemory, SunIF, CollSyncIF } from '@wonderlandlabs/multiverse';

class EnhancedSun<RecordType, KeyType> extends SunMemory<RecordType, KeyType> {
  // Add additional methods or override existing ones
  set(key: KeyType, record: RecordType) {
    // Add custom logic before storing
    console.log(`Setting record with key ${String(key)}`);

    // Call the parent implementation
    super.set(key, record);

    // Add custom logic after storing
    this.notifySubscribers(key, record);
  }

  // Add new methods
  notifySubscribers(key: KeyType, record: RecordType) {
    // Custom implementation
  }
}

// Factory function to create instances of your Sun
export default function enhancedSunF<RecordType, KeyType>(
  coll: CollSyncIF<RecordType, KeyType>,
): SunIF<RecordType, KeyType> {
  return new EnhancedSun<RecordType, KeyType>(coll);
}
```

### Implementing Custom Suns from Scratch

You can also implement the `SunIF` interface directly or extend the `SunBase` class to create completely custom Sun implementations for various use cases:

#### RxJS Integration

```typescript
import { SunBase, SunIF, CollSyncIF } from '@wonderlandlabs/multiverse';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

class RxJSSun<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollSyncIF<RecordType, KeyType>>
  implements SunIF<RecordType, KeyType>
{
  private subjects: Map<KeyType, BehaviorSubject<RecordType | undefined>> = new Map();

  get(key: KeyType) {
    return this.getSubject(key).getValue();
  }

  set(key: KeyType, record: RecordType) {
    this.validate(record);
    this.getSubject(key).next(record);
  }

  delete(key: KeyType) {
    const subject = this.subjects.get(key);
    if (subject) {
      subject.next(undefined);
      this.subjects.delete(key);
    }
  }

  clear() {
    for (const [key, subject] of this.subjects.entries()) {
      subject.next(undefined);
    }
    this.subjects.clear();
  }

  has(key: KeyType) {
    return (
      this.subjects.has(key) && this.getSubject(key).getValue() !== undefined
    );
  }

  // Get an observable for a specific key
  observe(key: KeyType): Observable<RecordType | undefined> {
    return this.getSubject(key).asObservable();
  }

  // Get an observable that emits all records
  observeAll(): Observable<Map<KeyType, RecordType>> {
    // Create a combined observable from all subjects
    return new Observable((subscriber) => {
      const result = new Map<KeyType, RecordType>();
      const updateSubscriber = () => subscriber.next(new Map(result));

      const subscriptions = Array.from(this.subjects.entries()).map(
        ([key, subject]) => {
          return subject.subscribe((value) => {
            if (value === undefined) {
              result.delete(key);
            } else {
              result.set(key, value);
            }
            updateSubscriber();
          });
        },
      );

      return () => {
        subscriptions.forEach((sub) => sub.unsubscribe());
      };
    });
  }

  private getSubject(key: KeyType): BehaviorSubject<RecordType | undefined> {
    if (!this.subjects.has(key)) {
      this.subjects.set(key, new BehaviorSubject<RecordType | undefined>(undefined));
    }
    return this.subjects.get(key)!;
  }
}
```

#### Remote API Integration

```typescript
import { SunBase, SunIF, CollAsyncIF } from '@wonderlandlabs/multiverse';

class RemoteAPISun<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollAsyncIF<RecordType, KeyType>>
  implements SunIF<RecordType, KeyType>
{
  private baseUrl: string;
  private cache: Map<KeyType, RecordType> = new Map();

  constructor(coll: CollAsyncIF<RecordType, KeyType>, baseUrl: string) {
    super();
    this.coll = coll;
    this.baseUrl = baseUrl;
  }

  async get(key: KeyType) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Fetch from API
    try {
      const response = await fetch(`${this.baseUrl}/${String(key)}`);
      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();
      this.cache.set(key, data);
      return data;
    } catch (error) {
      console.error(`Error fetching record with key ${String(key)}:`, error);
      return undefined;
    }
  }

  async set(key: KeyType, record: RecordType) {
    this.validate(record);

    // Send to API
    try {
      const response = await fetch(`${this.baseUrl}/${String(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        throw new Error(`Failed to update record with key ${String(key)}`);
      }

      // Update cache
      this.cache.set(key, record);
    } catch (error) {
      console.error(`Error setting record with key ${String(key)}:`, error);
      throw error;
    }
  }

  async delete(key: KeyType) {
    try {
      const response = await fetch(`${this.baseUrl}/${String(key)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete record with key ${String(key)}`);
      }

      // Update cache
      this.cache.delete(key);
    } catch (error) {
      console.error(`Error deleting record with key ${String(key)}:`, error);
      throw error;
    }
  }

  async clear() {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear all records');
      }

      // Clear cache
      this.cache.clear();
    } catch (error) {
      console.error('Error clearing records:', error);
      throw error;
    }
  }

  async has(key: KeyType) {
    // Check cache first
    if (this.cache.has(key)) {
      return true;
    }

    // Check API
    try {
      const response = await fetch(`${this.baseUrl}/${String(key)}`, {
        method: 'HEAD',
      });
      return response.ok;
    } catch (error) {
      console.error(`Error checking if key ${String(key)} exists:`, error);
      return false;
    }
  }
}

// Factory function to create instances of your Sun
export default function remoteAPISunF<RecordType, KeyType>(
  coll: CollAsyncIF<RecordType, KeyType>,
  baseUrl: string,
): SunIF<RecordType, KeyType> {
  return new RemoteAPISun<RecordType, KeyType>(coll, baseUrl);
}
```

These examples demonstrate how you can implement custom Sun implementations for various use cases. The Multiverse architecture is designed to be flexible, allowing you to integrate with different storage mechanisms while maintaining a consistent interface for collections.

### Caching Strategies for Custom Suns

Suns can implement different caching strategies depending on your application's needs:

#### Local Cache (Like Memory Sun)

The standard `SunMemory` implementation maintains a complete local cache of all data, which is ideal for:

- Small to medium-sized datasets
- Frequently accessed data
- Offline-first applications
- Reducing network requests

#### Passthrough (No Local Cache)

For large datasets or when memory usage is a concern, you can implement a passthrough Sun that doesn't maintain a local cache:

```typescript
import { SunBase, SunIF, CollAsyncIF } from '@wonderlandlabs/multiverse';

class PassthroughAPISun<RecordType, KeyType>
  extends SunBase<RecordType, KeyType, CollAsyncIF<RecordType, KeyType>>
  implements SunIF<RecordType, KeyType>
{
  private baseUrl: string;

  constructor(coll: CollAsyncIF<RecordType, KeyType>, baseUrl: string) {
    super();
    this.coll = coll;
    this.baseUrl = baseUrl;
  }

  async get(key: KeyType) {
    // Always fetch from API, no local cache
    try {
      const response = await fetch(`${this.baseUrl}/${String(key)}`);
      if (!response.ok) {
        return undefined;
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching record with key ${String(key)}:`, error);
      return undefined;
    }
  }

  async set(key: KeyType, record: RecordType) {
    this.validate(record);

    // Send to API, don't store locally
    try {
      const response = await fetch(`${this.baseUrl}/${String(key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        throw new Error(`Failed to update record with key ${String(key)}`);
      }
    } catch (error) {
      console.error(`Error setting record with key ${String(key)}:`, error);
      throw error;
    }
  }

  // Other methods similarly don't use local cache
}
```

This approach is beneficial for:

- Very large datasets that would consume too much memory if cached locally
- Data that changes frequently on the server
- Applications where memory usage is a critical concern
- Systems where the remote source (database, API) already has efficient querying capabilities

#### Hybrid Caching

You can also implement hybrid caching strategies:

1. **LRU Cache**: Keep only the most recently used items in memory
2. **TTL Cache**: Cache items for a limited time before refreshing from the source
3. **Partial Cache**: Cache only specific fields or a subset of records
4. **On-demand Cache**: Cache items only when explicitly requested to be cached

The flexibility of the Sun interface allows you to implement the caching strategy that best fits your application's requirements and constraints.
