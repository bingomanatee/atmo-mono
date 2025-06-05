import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { globalStateManager } from './globalState';
import { globalProcessMonitor } from './ProcessMonitor';

// Initialize the core system
console.log('🚀 Initializing Atmo Plates Visualization');

// Start the process monitor (handles message interception and state updates)
console.log('📡 Starting ProcessMonitor...');

// The globalProcessMonitor and globalStateManager are already initialized
// via their module imports, so they're ready to use

// Find or create the React container
let container = document.getElementById('react-process-monitor');
if (!container) {
  container = document.createElement('div');
  container.id = 'react-process-monitor';
  document.body.appendChild(container);
}

// Create React root and render the app
console.log('⚛️ Mounting React ProcessMonitorApp...');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Make global instances available for debugging
if (typeof window !== 'undefined') {
  (window as any).stateManager = globalStateManager;
  (window as any).processMonitor = globalProcessMonitor;
  (window as any).reactRoot = root;
}

console.log('✅ Atmo Plates Visualization initialized successfully');

// Optional: Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  console.log('🧹 Cleaning up React app...');
  root.unmount();
});

// Export for external access if needed
export { root, globalStateManager, globalProcessMonitor };
