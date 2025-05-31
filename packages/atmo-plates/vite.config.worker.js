import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  // Worker-specific build configuration
  build: {
    // Output to dist/workers directory
    outDir: "dist/workers",

    // Library mode for workers
    lib: {
      entry: {
        "platelet-worker": resolve(__dirname, "src/workers/platelet-worker.ts"),
      },
      formats: ["es"], // ES modules for modern worker support
      fileName: (format, entryName) => `${entryName}.js`,
    },

    // Rollup options for worker bundling
    rollupOptions: {
      // Strategy 2: Don't externalize dependencies - bundle them
      // This ensures workers are self-contained
      external: [],

      output: {
        // Ensure dynamic imports are inlined for worker context
        inlineDynamicImports: false,

        // Preserve module structure for better debugging
        preserveModules: false,

        // Use ES module format
        format: "es",
      },
    },

    // Target web workers specifically
    target: "esnext",

    // Generate source maps for debugging
    sourcemap: true,

    // Minify for production
    minify: "esbuild",

    // Clear output directory
    emptyOutDir: true,
  },

  // Define environment variables for workers
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production"
    ),
    "import.meta.env.WORKER_BUILD": "true",
  },

  // Resolve configuration for worker dependencies
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@workers": resolve(__dirname, "src/workers"),
    },
  },

  // Optimize dependencies for worker context
  optimizeDeps: {
    // Include dependencies that should be pre-bundled
    include: [
      "@wonderlandlabs/multiverse",
      "@wonderlandlabs/atmo-utils",
      "three",
      "dexie",
    ],
  },

  // Worker-specific plugins (if needed)
  plugins: [
    // Add any worker-specific plugins here
  ],
});
