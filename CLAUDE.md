# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a TypeScript monorepo using Yarn workspaces with four main packages:

- **`@wonderlandlabs/atmo-plates`** - Plate tectonics simulation library with 3D visualization capabilities
- **`@wonderlandlabs/multiverse`** - Core data management and reactive state system using RxJS
- **`@wonderlandlabs/atmo-utils`** - Shared utilities including H3 hexagonal grid operations, vector math, and geometry helpers
- **`@wonderlandlabs/atmo-three-orbit`** - Three.js orbital camera controls and 3D scene management

## Core Architecture

The simulation architecture follows a data-driven approach:

1. **Multiverse** provides the foundational reactive data layer with schema validation
2. **PlateSimulation** orchestrates plate tectonics using managers for different aspects (plates, platelets)
3. **H3 hexagonal grids** are used for spatial indexing and plate discretization
4. **Three.js** handles 3D visualization with custom orbital controls

Key architectural patterns:
- Manager pattern for stateless, indexed simulation components
- Schema-driven data validation and transformation
- Reactive streams via RxJS for state management
- Workspace dependencies enable shared utilities across packages

## Development Commands

### Root Level (Monorepo)
```bash
# Install dependencies for all packages
yarn install

# Run tests across all packages  
yarn test

# Build all packages
yarn build
```

### Package Level (run from package directories)
```bash
# Build individual package
yarn build

# Run tests for specific package
yarn test
yarn test:watch    # Watch mode
yarn test:ui       # UI test runner

# Build with types
yarn build:all
```

### Testing
- Uses Vitest as the test runner
- Test files use `.spec.ts` extension
- Global test configuration in `vite.config.ts`
- Individual packages have their own `vitest.config.ts`

## Key Dependencies
- **h3-js**: Hexagonal grid system for spatial operations
- **three**: 3D graphics and visualization
- **rxjs**: Reactive programming and state streams
- **uuid**: Unique identifier generation
- **immer**: Immutable state updates
- **lodash-es**: Utility functions

## Development Notes
- TypeScript with strict configuration
- ES modules throughout (`"type": "module"`)
- Workspace dependencies use `workspace:*` protocol
- Package manager is Yarn 4.9.1