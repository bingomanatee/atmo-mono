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
        preserveModules: true,
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
