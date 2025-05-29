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
