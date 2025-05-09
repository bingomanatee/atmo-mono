/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    tsconfig: './tsconfig.vite.json',
    globals: true,
    environment: 'node', // or 'jsdom' if testing browser code
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
