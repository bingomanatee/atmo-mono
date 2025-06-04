#!/usr/bin/env node

/**
 * Copy built worker files to consuming packages
 * This ensures the worker is available at the correct URL for browser loading
 */

import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceWorker = resolve(__dirname, '../dist/workers/platelet-worker.js');
const targetWorker = resolve(__dirname, '../../atmo-plates-visualization/public/platelet-worker.js');

console.log('🔧 Copying worker files...');
console.log(`Source: ${sourceWorker}`);
console.log(`Target: ${targetWorker}`);

if (!existsSync(sourceWorker)) {
  console.error('❌ Source worker file not found. Run "npm run build:workers" first.');
  process.exit(1);
}

try {
  copyFileSync(sourceWorker, targetWorker);
  console.log('✅ Worker file copied successfully!');
  console.log('🎉 Worker is now available at /platelet-worker.js for browser loading');
} catch (error) {
  console.error('❌ Failed to copy worker file:', error.message);
  process.exit(1);
}
