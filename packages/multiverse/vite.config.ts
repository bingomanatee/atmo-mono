import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index'),
      name: 'multiverse',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['@wonderlandlabs/atmo-utils'],
      output: {
        // Remove preserveModules to bundle everything into a single file
      },
    },
  },
  resolve: {
    alias: {
      '@wonderlandlabs/atmo-utils': resolve(
        __dirname,
        '../atmo-utils/dist/index.js',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
