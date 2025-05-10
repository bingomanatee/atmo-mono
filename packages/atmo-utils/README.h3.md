# H3 Utilities for Atmo

This module provides a comprehensive set of utilities for working with the [H3 geospatial indexing system](https://h3geo.org/) in the Atmo project. It wraps and extends the functionality of the [h3-js](https://github.com/uber/h3-js) library.

## Installation

The H3 utilities are part of the `@wonderlandlabs/atmo-utils` package. The h3-js library is included as a dependency.

## Terminology

This library follows the official H3 terminology:

- **Cell**: A hexagonal (or pentagonal) grid cell in the H3 system
- **Resolution**: The level of detail in the H3 grid system (0-15)
- **H3Index**: A string representation of an H3 cell index

## Core Functions

### Cell Creation and Conversion

```typescript
// Convert lat/lng to an H3 cell index
const h3Index = latLngToCell(37.7749, -122.4194, 9);

// Get the center coordinates of a cell
const { lat, lng } = cellToLatLng(h3Index);

// Get the boundary vertices of a cell
const boundary = cellToBoundary(h3Index);
```

### Cell Properties

```typescript
// Get the resolution of a cell
const resolution = getResolution(h3Index);

// Check if a cell index is valid
const isValid = isValidCell(h3Index);

// Get the area of a cell in square meters
const area = cellArea(h3Index);

// Get the edge length of a cell in meters
const edgeLength = getEdgeLengthAvg(h3Index);
```

### Cell Relationships

```typescript
// Get the neighbors of a cell
const neighbors = getNeighbors(h3Index);

// Get all cells within a certain distance
const cellsInRange = getCellsInRange(h3Index, 2);

// Check if two cells are neighbors
const areNeighbors = areNeighborCells(h3Index1, h3Index2);

// Get the grid distance between two cells
const distance = gridDistance(h3Index1, h3Index2);
```

### Hierarchical Operations

```typescript
// Get the parent cell at a lower resolution
const parent = cellToParent(h3Index, 8);

// Get all child cells at a higher resolution
const children = cellToChildren(h3Index, 10);

// Compact a set of cells (represent the same area with fewer cells)
const compacted = compactCells(cellArray);

// Uncompact a set of cells to a specific resolution
const uncompacted = uncompactCells(compactedArray, 10);
```

### Geometric Calculations

```typescript
// Calculate the radius of a cell at a specific resolution for a planet
const radius = h3HexRadiusAtResolution(planetRadius, resolution);

// Calculate the area of a cell at a specific resolution for a planet
const area = h3HexArea(resolution, planetRadius);

// Convert multiple points to cell indices
const cellIndices = pointsToCell(points, resolution);
```

## Planetary System Integration

These utilities are particularly useful for the planetary system in the atmo-sim package, allowing for efficient spatial indexing and operations on planetary surfaces with different radii.

```typescript
// Example: Calculate cell area for Mars
const marsRadius = 3389500; // meters
const cellArea = h3HexArea(9, marsRadius);
```

## Consistency with H3 Library

This utility module maintains consistency with the official H3 library terminology and function naming conventions, making it easier to reference the [official H3 documentation](https://h3geo.org/docs/).

## Performance Considerations

- The H3 utilities include caching for frequently used calculations like cell radius
- For operations on large numbers of cells, consider using the compact/uncompact functions to reduce the number of cells being processed
- When working with planetary systems, pre-calculate and cache values for specific resolutions when possible
