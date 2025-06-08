import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'atmoWorkers',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't empty since we build types separately
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      external: (id) => {
        // External all dependencies and Node.js built-ins
        return (
          id.startsWith('@wonderlandlabs/') ||
          id.startsWith('node:') ||
          [
            'rxjs',
            'uuid',
            'events',
            'fs',
            'path',
            'worker_threads',
            'os',
            'fsevents',
            'lodash-es',
          ].includes(id) ||
          id.includes('node_modules')
        );
      },
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
