import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'atmoWorkers',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      external: [
        '@wonderlandlabs/multiverse',
        'rxjs',
        'uuid',
        'events',
        'fs',
        'path',
        'worker_threads',
        'os'
      ],
      output: {
        globals: {
          '@wonderlandlabs/multiverse': 'multiverse',
          'rxjs': 'rxjs',
          'uuid': 'uuid',
          'events': 'events',
          'fs': 'fs',
          'path': 'path',
          'worker_threads': 'worker_threads',
          'os': 'os'
        },
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
