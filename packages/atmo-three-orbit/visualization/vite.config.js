import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      // This allows importing from the parent directory
      "@": resolve(__dirname, "../"),
      three: resolve(__dirname, "../../../node_modules/three"),
    },
  },
  build: {
    outDir: "dist",
    // Control chunk generation
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        // Ensure we don't get multiple index files
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
        // Prevent code splitting
        manualChunks: undefined,
      },
    },
  },
  server: {
    open: true,
  },
  // Enable TypeScript support
  optimizeDeps: {
    include: ["three"],
  },
});
