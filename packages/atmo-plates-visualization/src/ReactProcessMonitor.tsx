import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ProcessMonitorApp from './components/ProcessMonitorApp';
import { StateManager } from './StateManager';

interface ReactProcessMonitorOptions {
  containerId?: string;
  stateManager?: StateManager;
  showControls?: boolean;
  showStatusInfo?: boolean;
  replaceExisting?: boolean;
}

export class ReactProcessMonitor {
  private root: Root | null = null;
  private container: HTMLElement | null = null;
  private stateManager?: StateManager;

  constructor(private options: ReactProcessMonitorOptions = {}) {
    this.stateManager = options.stateManager;
  }

  public mount(targetElement?: HTMLElement): HTMLElement {
    const {
      containerId = 'react-process-monitor',
      replaceExisting = true,
      showControls = true,
      showStatusInfo = true,
    } = this.options;

    // Create or find container
    if (targetElement) {
      this.container = targetElement;
    } else {
      this.container = document.getElementById(containerId);

      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = containerId;
        this.setupContainerStyles();
        document.body.appendChild(this.container);
      }
    }

    // Hide existing elements if requested
    if (replaceExisting) {
      this.hideExistingElements();
    }

    // Create React root and render
    this.root = createRoot(this.container);
    this.root.render(
      <ProcessMonitorApp
        showControls={showControls}
        showStatusInfo={showStatusInfo}
      />,
    );

    return this.container;
  }

  public unmount(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }

    // Restore hidden elements
    this.restoreExistingElements();
  }

  public update(): void {
    if (this.root) {
      this.root.render(
        <ProcessMonitorApp
          showControls={this.options.showControls}
          showStatusInfo={this.options.showStatusInfo}
        />,
      );
    }
  }

  private setupContainerStyles(): void {
    if (this.container) {
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
      `;

      // Allow pointer events on child elements
      this.container.style.pointerEvents = 'none';
      const style = document.createElement('style');
      style.textContent = `
        #${this.container.id} > * {
          pointer-events: auto;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private hideExistingElements(): void {
    const elementsToHide = ['storage-info', 'worker-info', 'performance-info'];

    elementsToHide.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = 'none';
        element.setAttribute('data-hidden-by-react', 'true');
      }
    });
  }

  private restoreExistingElements(): void {
    const hiddenElements = document.querySelectorAll(
      '[data-hidden-by-react="true"]',
    );
    hiddenElements.forEach((element) => {
      (element as HTMLElement).style.display = '';
      element.removeAttribute('data-hidden-by-react');
    });
  }

  public getContainer(): HTMLElement | null {
    return this.container;
  }

  public isReady(): boolean {
    return this.root !== null && this.container !== null;
  }
}

// Global instance management
let globalReactMonitor: ReactProcessMonitor | null = null;

export function initializeReactProcessMonitor(
  options: ReactProcessMonitorOptions = {},
): ReactProcessMonitor {
  if (globalReactMonitor) {
    globalReactMonitor.unmount();
  }

  globalReactMonitor = new ReactProcessMonitor(options);
  globalReactMonitor.mount();

  // Make available globally for debugging
  (window as any).reactProcessMonitor = globalReactMonitor;

  return globalReactMonitor;
}

export function getReactProcessMonitor(): ReactProcessMonitor | null {
  return globalReactMonitor;
}

export function destroyReactProcessMonitor(): void {
  if (globalReactMonitor) {
    globalReactMonitor.unmount();
    globalReactMonitor = null;
    delete (window as any).reactProcessMonitor;
  }
}

// Utility function to initialize React ProcessMonitor
export function replaceProcessTableWithReact(
  stateManager?: StateManager,
): ReactProcessMonitor {
  // Initialize React version (vanilla table no longer exists)
  return initializeReactProcessMonitor({
    stateManager,
    replaceExisting: true,
    showControls: true,
    showStatusInfo: true,
  });
}

// Integration with existing ProcessMonitor - uses single global instance
export function integrateWithProcessMonitor(): ReactProcessMonitor | null {
  if (typeof window !== 'undefined') {
    const processMonitor = (window as any).processMonitor; // Single global instance
    if (processMonitor && processMonitor.getStateManager) {
      console.log(
        '🔗 Integrating React ProcessTable with global ProcessMonitor instance',
      );
      return replaceProcessTableWithReact(processMonitor.getStateManager());
    } else {
      console.warn(
        '⚠️ Global ProcessMonitor instance not found on window.processMonitor',
      );
    }
  }
  return null;
}

// Auto-initialization when imported
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        // Try to auto-integrate if process monitor exists
        const processMonitor = (window as any).processMonitor;
        if (processMonitor) {
          console.log(
            '🔄 Auto-integrating React ProcessTable with existing ProcessMonitor',
          );
          integrateWithProcessMonitor();
        }
      }, 1000); // Give time for process monitor to initialize
    });
  } else {
    // DOM is already ready
    setTimeout(() => {
      const processMonitor = (window as any).processMonitor;
      if (processMonitor) {
        console.log(
          '🔄 Auto-integrating React ProcessTable with existing ProcessMonitor',
        );
        integrateWithProcessMonitor();
      }
    }, 1000);
  }
}

export default ReactProcessMonitor;
