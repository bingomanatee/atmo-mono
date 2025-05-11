import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'atmo-utils',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['lodash-es', 'h3-js', 'three'],
      output: {
        preserveModules: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
