import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'atmoPlates',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['@wonderlandlabs/multiverse', 'h3-js', 'lodash-es', 'three'],
      output: {
        globals: {
          '@wonderlandlabs/multiverse': 'multiverse',
          'h3-js': 'h3',
          'lodash-es': '_',
          three: 'THREE',
        },
        // Remove preserveModules to bundle everything into a single file
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
