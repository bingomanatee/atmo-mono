# Web Workers for Atmo Plates

This directory contains Web Worker implementations for computationally intensive operations in the Atmo Plates simulation.

## 🎯 Current Strategy: Strategy 1 - Bundle All Dependencies

We're currently using **Strategy 1** which bundles all dependencies directly into the worker for maximum compatibility and portability.

### Benefits of Strategy 1 (Current)

- ✅ Self-contained worker bundle (363KB)
- ✅ No external dependency management
- ✅ Works in any Web Worker environment
- ✅ Portable and cacheable
- ✅ Version-locked dependencies
- ✅ Easy deployment (single file)

### File Structure

```
src/workers/
├── README.md                           # This file
├── shared/
│   └── multiverse-worker-utils.ts      # Utility functions (bundled into worker)
├── platelet-worker.ts                  # Main platelet generation worker
└── types/
    └── worker-types.ts                 # Worker-specific types

dist/workers/
├── platelet-worker.js                  # Built worker bundle (363KB)
└── platelet-worker.js.map              # Source map for debugging
```

## 🔧 How Strategy 1 Works (Current Implementation)

### Self-Contained Bundle

The build process bundles everything into `dist/workers/platelet-worker.js`:

- **Multiverse** - Complete multiverse library
- **DexieSun** - IndexedDB storage with `dontClear` support
- **H3 utilities** - All spatial indexing functions
- **Three.js Vector3** - 3D math utilities
- **Dexie** - IndexedDB wrapper
- **All dependencies** - No external imports needed

### Worker Implementation

```typescript
// platelet-worker.ts (gets bundled with all dependencies)
import {
  initWorkerMultiverse,
  performGridDiskComputationWorker,
} from './shared/multiverse-worker-utils';

self.onmessage = async function (e) {
  const multiverse = await initWorkerMultiverse(e.data.universeId);
  const result = await performGridDiskComputationWorker(/* params */);
  self.postMessage(result);
};
```

### Actual Build Output

- **Bundle Size**: 363KB (minified)
- **Source Map**: Available for debugging
- **Dependencies**: All bundled internally
- **Format**: ES module for modern browsers

## ⚠️ Fallback: Strategy 1 - Bundle All Dependencies

If Strategy 2 encounters issues (import problems, build complexity, etc.), we can fall back to **Strategy 1**.

### When to Switch to Strategy 1

- Import resolution issues in worker context
- Build system complications
- Module loading failures
- Performance requirements (single bundle)

### Strategy 1 Implementation Notes

#### Build Configuration

```javascript
// vite.config.worker.js
export default {
  entry: './src/workers/platelet-worker.ts',
  build: {
    lib: {
      entry: './src/workers/platelet-worker.ts',
      formats: ['iife'], // Self-executing function for worker
      name: 'PlateletWorker',
    },
    rollupOptions: {
      external: [], // Don't externalize anything - bundle it all
      output: {
        inlineDynamicImports: true, // Bundle dynamic imports too
      },
    },
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};
```

#### Direct Imports in Worker

```typescript
// platelet-worker.ts (Strategy 1 version)
import { Multiverse } from '@wonderlandlabs/multiverse';
import { DexieSun } from '../PlateSimulation/sun/DexieSun';
import { getCellsInRange, cellToVector } from '@wonderlandlabs/atmo-utils';
import { Vector3 } from 'three';

// All dependencies bundled directly into worker
self.onmessage = async function (e) {
  const multiverse = new Multiverse({
    name: e.data.universeId,
    dontClear: true,
  });
  // ... direct usage of imported utilities
};
```

#### Bundle Size Considerations (Strategy 1)

- Multiverse core: ~50KB
- DexieSun: ~20KB
- H3 utilities: ~30KB
- Three.js Vector3: ~10KB
- Dexie: ~100KB
- **Total: ~200KB** (acceptable for functionality provided)

## 🚀 Build Process

### Current (Strategy 2)

```bash
npm run build:workers  # Builds workers with shared utilities
```

### Fallback (Strategy 1)

```bash
npm run build:workers:bundle  # Builds workers with all dependencies bundled
```

## 🔄 Migration Path

If we need to switch from Strategy 2 to Strategy 1:

1. **Update worker entry point** to use direct imports
2. **Modify build configuration** to bundle all dependencies
3. **Update package.json scripts** for new build process
4. **Test worker functionality** in target environments
5. **Update documentation** to reflect new approach

## 🧪 Testing Workers

### Development

```typescript
// Test worker in development
const worker = new Worker('./src/workers/platelet-worker.ts', {
  type: 'module',
});
```

### Production

```typescript
// Test built worker
const worker = new Worker('/dist/workers/platelet-worker.js');
```

## 📝 Notes

- Workers use `dontClear: true` to preserve shared IndexedDB data
- All heavy computation happens in worker thread
- Results are stored back to shared multiverse database
- Main thread sees updates automatically via multiverse subscriptions
- Lightweight communication (only seed IDs and parameters)

## 🎯 Performance Goals

- Keep main thread responsive during heavy computations
- Minimize data transfer between threads
- Maximize shared state efficiency
- Enable parallel processing of multiple plates
