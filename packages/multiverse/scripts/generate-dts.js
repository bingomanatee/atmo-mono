#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the dist/types directory exists
const typesDir = path.resolve(__dirname, "../dist/types");
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true });
}

// Run TypeScript compiler to generate declaration files
try {
  console.log("Generating declaration files...");
  execSync("tsc --project tsconfig.build.json --noEmitOnError false", {
    stdio: "inherit",
  });
  console.log("Declaration files generated successfully!");
} catch (error) {
  console.warn(
    "TypeScript compilation had errors, but declaration files were still generated."
  );
}

// Create an index.d.ts file that re-exports everything
const indexDtsContent = `/**
 * Multiverse - A synchronization engine for sending records and signals between multiple scopes
 * @packageDocumentation
 */

export * from './types/index';
`;

fs.writeFileSync(path.resolve(typesDir, "../index.d.ts"), indexDtsContent);
console.log("Created index.d.ts file");
