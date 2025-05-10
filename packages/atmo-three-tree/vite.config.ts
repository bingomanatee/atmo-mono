import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'atmo-three-tree',
      fileName: 'index',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['three', '@wonderlandlabs/multiverse', '@wonderlandlabs/atmo-utils'],
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
