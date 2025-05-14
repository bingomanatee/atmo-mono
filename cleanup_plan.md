# Cleanup Plan for Redundant Methods

## Summary of Redundant Methods to Remove

1. `find$` - Redundant with `find` generator method
2. `getAll$` - Redundant with `getAll` generator method
3. `getMany$` - Redundant with `getMany` generator method
4. `getAllAsMap` - Redundant with `getAll` generator method (can convert to Map)
5. `getManyAsMap` - Redundant with `getMany` generator method (can convert to Map)
6. `sendMany$` - Redundant with `sendMany` method
7. `sendAll$` - Redundant with `sendAll` method

## 1. In `types.coll.ts`

### Remove from `CollBaseIF` interface:

- Remove `find$` method (lines 8-16)

### Remove from `CollSyncIF` interface:

- Remove `getAll$` method (lines 85-93)
- Remove `getMany$` method (lines 74-84)
- Remove `getAllAsMap` method
- Remove `getManyAsMap` method
- Remove `setMany$` method
- Update `sendMany` signature to return Observable instead of array of keys
- Update `sendAll` signature to return Observable instead of array of keys

### Remove from `CollAsyncIF` interface:

- Remove `getAll$` method (lines 195-203)
- Remove `getMany$` method (lines 184-194)
- Remove `getAllAsMap` method
- Remove `getManyAsMap` method
- Remove `setMany$` method
- Update `sendMany` signature to return Observable instead of Promise<array>
- Update `sendAll` signature to return Observable instead of Promise<array>

## 2. In `CollBase.ts`

- Remove `abstract find$?()` method
- Remove `abstract getAll$?()` method (line 119)
- Remove any references to `getMany$`
- Remove any references to `setMany$`

## 3. In `CollSync.ts`

- Remove the `find$` method implementation
- Remove the `getAll$` method implementation (lines 390-419)
- Remove the `getMany$` method implementation (lines 336-389)
- Remove the `getAllAsMap` method implementation
- Remove the `getManyAsMap` method implementation
- Remove the `sendMany$` method implementation (lines 544-600)
- Remove the `sendAll$` method implementation
- Remove the `createObservableFromGenerator` helper method
- Update `sendMany` to use `getMany` directly instead of `getMany$` (line 525)
- Update `sendAll` to use `getAll` directly

## 4. In `types.multiverse.ts`

- Remove any references to `getAll$` and `getMany$`

## 5. In Sun implementations

- Remove any `getAll$` method implementations
- Remove any `getMany$` method implementations

## 6. Update tests

- Remove any tests that rely on these methods
- Update any tests that use these methods to use the generator-based methods instead
