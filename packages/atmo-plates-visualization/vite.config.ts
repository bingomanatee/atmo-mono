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
      },
      output: {
        manualChunks: {
          // Separate Three.js into its own chunk
          three: ['three'],
          // Separate Three.js examples into their own chunk
          'three-examples': ['three/examples/jsm/controls/OrbitControls.js'],
          // Separate atmo libraries into their own chunk
          'atmo-libs': [
            '@wonderlandlabs/atmo-plates',
            '@wonderlandlabs/atmo-three-orbit',
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
