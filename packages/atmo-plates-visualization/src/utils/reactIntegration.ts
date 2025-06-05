import { createRoot, type Root } from 'react-dom/client';
import React from 'react';

// Global state for React integration
let reactRoot: Root | null = null;
let reactContainer: HTMLElement | null = null;
let hiddenElements: HTMLElement[] = [];

/**
 * Mount the React ProcessMonitorApp
 */
export async function mountProcessMonitorApp(
  container?: HTMLElement,
): Promise<HTMLElement> {
  // Cleanup any existing React UI
  if (reactRoot) {
    unmountProcessMonitorApp();
  }

  // Create or find container
  if (container) {
    reactContainer = container;
  } else {
    reactContainer = document.getElementById('react-process-monitor');
    if (!reactContainer) {
      reactContainer = document.createElement('div');
      reactContainer.id = 'react-process-monitor';
      reactContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 800px;
        max-height: 80vh;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
      `;
      document.body.appendChild(reactContainer);
    }
  }

  // Hide existing vanilla UI elements
  hideVanillaElements();

  // Dynamic import of React component to avoid bundling issues
  const { default: ProcessMonitorApp } = await import(
    '../components/ProcessMonitorApp'
  );

  // Create React root and render
  reactRoot = createRoot(reactContainer);
  reactRoot.render(
    React.createElement(ProcessMonitorApp, {
      showControls: true,
      showStatusInfo: true,
    }),
  );

  return reactContainer;
}

/**
 * Unmount the React ProcessMonitorApp
 */
export function unmountProcessMonitorApp(): void {
  // Unmount React
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  // Remove container if we created it
  if (
    reactContainer &&
    reactContainer.id === 'react-process-monitor' &&
    reactContainer.parentNode
  ) {
    reactContainer.parentNode.removeChild(reactContainer);
  }
  reactContainer = null;

  // Restore hidden vanilla elements
  restoreVanillaElements();
}

/**
 * Hide existing vanilla UI elements
 */
function hideVanillaElements(): void {
  const elementsToHide = ['storage-info', 'worker-info', 'performance-info'];

  hiddenElements = [];
  elementsToHide.forEach((id) => {
    const element = document.getElementById(id);
    if (element && element.style.display !== 'none') {
      hiddenElements.push(element);
      element.style.display = 'none';
      element.setAttribute('data-hidden-by-react', 'true');
    }
  });
}

/**
 * Restore hidden vanilla UI elements
 */
function restoreVanillaElements(): void {
  hiddenElements.forEach((element) => {
    element.style.display = '';
    element.removeAttribute('data-hidden-by-react');
  });
  hiddenElements = [];
}

/**
 * Check if React UI is currently mounted
 */
export function isReactUIMounted(): boolean {
  return reactRoot !== null && reactContainer !== null;
}

/**
 * Simple function to mount React ProcessMonitor
 */
export async function replaceProcessTableWithReact(
  container?: HTMLElement,
): Promise<HTMLElement> {
  console.log('🔄 Mounting React ProcessMonitor');
  return mountProcessMonitorApp(container);
}
