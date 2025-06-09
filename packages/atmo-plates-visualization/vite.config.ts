/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        fd: './src/fd.html',
        platelet: './src/platelet.html',
        'platelet-worker': './src/platelet-worker.ts',
      },

      output: {
        // Custom filename for the worker to avoid hashing and put in root
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'platelet-worker') {
            return 'platelet-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        // Custom chunk filename to avoid hashing for atmo-libs (needed by worker)
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'atmo-libs') {
            return 'assets/atmo-libs.js';
          }
          return 'assets/[name]-[hash].js';
        },

        manualChunks: {
          // Separate Three.js into its own chunk
          three: ['three'],
          // Separate Three.js examples into their own chunk
          'three-examples': ['three/examples/jsm/controls/OrbitControls.js'],
          // Separate atmo libraries into their own chunk
          'atmo-libs': [
            '@wonderlandlabs/atmo-plates',
            '@wonderlandlabs/atmo-three-orbit',
            '@wonderlandlabs/atmo-workers',
            '@wonderlandlabs/atmo-utils',
          ],
          // Separate vendor libraries
          vendor: ['lodash-es'],
        },
      },
    },
  },
  server: {
    // Disable historyApiFallback to allow serving multiple HTML files
    historyApiFallback: false,
  },
  test: {
    tsconfig: './tsconfig.vite.json',
    globals: true,
    environment: 'node', // or 'jsdom' if testing browser code
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
