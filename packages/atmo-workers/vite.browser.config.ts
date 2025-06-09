import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.browser.ts'),
      name: 'atmoWorkersBrowser',
      fileName: 'index.browser',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't empty since main build runs first
    sourcemap: true,
    rollupOptions: {
      external: [
        '@wonderlandlabs/multiverse',
        '@wonderlandlabs/atmo-utils',
        'rxjs',
        'uuid',
        'events',
        'lodash-es',
        'fs',
        'path',
        'worker_threads',
        'os',
        'fsevents',
      ],
    },
  },
  resolve: {
    alias: {
      '@wonderlandlabs/multiverse': resolve(
        __dirname,
        '../multiverse/dist/index.js',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
