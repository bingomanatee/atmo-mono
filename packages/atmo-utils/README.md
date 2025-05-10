# atmo-utils

A collection of utility functions and classes for the Atmo project.

## Features

### Collection Utilities

- `ExtendedMap`: An extension of the standard JavaScript `Map` class that adds a powerful `find` method for searching.
- `IndexedMap`: Extends `Map` and adds the same `find` method as `ExtendedMap`, but with the addition of indexing for more efficient searches.

See the [Collections README](src/collections/README.md) for more details.

### Vector Utilities

- `flattenVector`: Flatten a vector to be tangential to a sphere at a given position.
- `latLonToPoint`: Convert latitude and longitude to a 3D point.
- `randomH3Point`: Generate a random point on the surface of a sphere.

### H3 Utilities

- Various utilities for working with the H3 geospatial indexing system.

### Other Utilities

- `asError`: Convert any value to an Error object.
- `isObj`: Check if a value is an object.
- `isString`: Check if a value is a string.
- `stringify`: Safely stringify a value.
- `vary`: Create a function that varies its output based on input.

## Building

Run `nx build atmo-utils` to build the library.

## Running unit tests

Run `nx test atmo-utils` to execute the unit tests via [Vitest](https://vitest.dev).
