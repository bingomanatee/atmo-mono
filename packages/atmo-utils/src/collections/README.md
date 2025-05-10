# Collection Utilities

This directory contains utility classes for working with collections in the atmo-utils package.

## ExtendedMap

`ExtendedMap` is an extension of the standard JavaScript `Map` class that adds powerful methods for searching, filtering, and reducing.

### Usage

```typescript
import { ExtendedMap } from '@wonderlandlabs/atmo-utils';

// Create a new ExtendedMap
const map = new ExtendedMap<string, number>();
map.set('a', 1);
map.set('b', 2);
map.set('c', 1);

// Find by value
const result1 = map.find(1);
// result1 is a Map containing { 'a' => 1, 'c' => 1 }

// Find by property
interface Person {
  name: string;
  age: number;
}

const peopleMap = new ExtendedMap<string, Person>();
peopleMap.set('p1', { name: 'Alice', age: 30 });
peopleMap.set('p2', { name: 'Bob', age: 25 });
peopleMap.set('p3', { name: 'Charlie', age: 30 });

// Find people who are 30 years old
const result2 = peopleMap.find('age', 30);
// result2 is a Map containing { 'p1' => {...}, 'p3' => {...} }

// Find by property with a function
const result3 = peopleMap.find('age', (age) => age > 25);
// result3 is a Map containing { 'p1' => {...}, 'p3' => {...} }

// Find using a predicate function
const result4 = peopleMap.find((person) => person.age > 25);
// result4 is a Map containing { 'p1' => {...}, 'p3' => {...} }

// Filter the map
const evenNumbers = map.filter(value => value % 2 === 0);
// evenNumbers is a Map containing { 'b' => 2 }

// Reduce the map
const sum = map.reduce((acc, value) => acc + value, 0);
// sum is 4 (1 + 2 + 1)

// Static methods work on regular Maps too
const regularMap = new Map<string, number>([['a', 1], ['b', 2]]);
const found = ExtendedMap.find(regularMap, (value) => value === 1);
// found is a Map containing { 'a' => 1 }
```

## IndexedMap

`IndexedMap` extends `ExtendedMap` and adds indexing for more efficient searches. Indexes are automatically invalidated when the map is modified and are lazily created only when needed.

### Features

- Lazy index creation - indexes are only created when needed
- Automatic index invalidation when the map is modified
- FIFO eviction policy to limit memory usage
- Fallback to non-indexed search if JSON.stringify fails

### Usage

```typescript
import { IndexedMap } from '@wonderlandlabs/atmo-utils';

// Create a new IndexedMap
const map = new IndexedMap<string, number>();
map.set('a', 1);
map.set('b', 2);
map.set('c', 1);

// Find by value (creates an index)
const result1 = map.find(1);
// result1 is a Map containing { 'a' => 1, 'c' => 1 }

// Find by value again (uses the existing index)
const result2 = map.find(1);
// result2 is a Map containing { 'a' => 1, 'c' => 1 }

// Modify the map (invalidates indexes)
map.set('d', 1);

// Find by value again (creates a new index)
const result3 = map.find(1);
// result3 is a Map containing { 'a' => 1, 'c' => 1, 'd' => 1 }

// Tune the maximum number of indexes for performance
const map = new IndexedMap();
map.maxIndexes = 200; // Default is 100
```

## When to Use Each Class

- Use `ExtendedMap` for simple collections where search performance is not critical
- Use `IndexedMap` for larger collections where you perform the same searches repeatedly

Both classes provide the same API, so you can easily switch between them as your needs change.
