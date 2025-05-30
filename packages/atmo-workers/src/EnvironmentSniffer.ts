/**
 * Environment detection and capability sniffing for worker management
 */

import type { EnvironmentCapabilities } from './types';

export class EnvironmentSniffer {
  private static _capabilities: EnvironmentCapabilities | null = null;

  /**
   * Detect environment capabilities
   */
  static getCapabilities(): EnvironmentCapabilities {
    if (this._capabilities) {
      return this._capabilities;
    }

    this._capabilities = this.detectCapabilities();
    return this._capabilities;
  }

  /**
   * Force re-detection of capabilities (useful for testing)
   */
  static refresh(): EnvironmentCapabilities {
    this._capabilities = null;
    return this.getCapabilities();
  }

  /**
   * Check if we're in a browser environment
   */
  static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * Check if we're in a Node.js environment
   */
  static isNode(): boolean {
    return typeof process !== 'undefined' && 
           process.versions != null && 
           process.versions.node != null;
  }

  /**
   * Check if Web Workers are available
   */
  static hasWebWorkers(): boolean {
    return typeof Worker !== 'undefined' && this.isBrowser();
  }

  /**
   * Check if Node.js Worker Threads are available
   */
  static hasNodeWorkers(): boolean {
    if (!this.isNode()) return false;
    
    try {
      // Try to require worker_threads
      require('worker_threads');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if IndexedDB is available
   */
  static hasIndexedDB(): boolean {
    if (!this.isBrowser()) return false;
    
    try {
      return 'indexedDB' in window && 
             window.indexedDB !== null && 
             window.indexedDB !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get hardware concurrency
   */
  static getConcurrency(): number {
    // Browser
    if (this.isBrowser() && 'navigator' in window && 'hardwareConcurrency' in navigator) {
      return navigator.hardwareConcurrency || 4;
    }
    
    // Node.js
    if (this.isNode()) {
      try {
        const os = require('os');
        return os.cpus().length;
      } catch {
        return 4;
      }
    }
    
    return 4; // Default fallback
  }

  /**
   * Detect all capabilities
   */
  private static detectCapabilities(): EnvironmentCapabilities {
    const webWorkers = this.hasWebWorkers();
    const nodeWorkers = this.hasNodeWorkers();
    const indexedDB = this.hasIndexedDB();
    const concurrency = this.getConcurrency();
    
    let environment: 'browser' | 'node' | 'unknown';
    if (this.isBrowser()) {
      environment = 'browser';
    } else if (this.isNode()) {
      environment = 'node';
    } else {
      environment = 'unknown';
    }

    return {
      webWorkers,
      nodeWorkers,
      indexedDB,
      environment,
      concurrency,
    };
  }

  /**
   * Get recommended worker count based on environment
   */
  static getRecommendedWorkerCount(): number {
    const capabilities = this.getCapabilities();
    
    // Conservative approach: use 50% of available cores, max 8
    const maxWorkers = Math.min(Math.ceil(capabilities.concurrency * 0.5), 8);
    
    // Minimum 1, maximum based on environment
    if (capabilities.environment === 'browser') {
      return Math.max(1, Math.min(maxWorkers, 4)); // Browser: max 4 workers
    } else if (capabilities.environment === 'node') {
      return Math.max(1, maxWorkers); // Node: can handle more workers
    }
    
    return 1; // Unknown environment: single worker
  }

  /**
   * Check if any worker system is available
   */
  static hasAnyWorkers(): boolean {
    const capabilities = this.getCapabilities();
    return capabilities.webWorkers || capabilities.nodeWorkers;
  }

  /**
   * Get a human-readable capability summary
   */
  static getCapabilitySummary(): string {
    const caps = this.getCapabilities();
    const parts = [
      `Environment: ${caps.environment}`,
      `Concurrency: ${caps.concurrency}`,
      `Web Workers: ${caps.webWorkers ? '✓' : '✗'}`,
      `Node Workers: ${caps.nodeWorkers ? '✓' : '✗'}`,
      `IndexedDB: ${caps.indexedDB ? '✓' : '✗'}`,
    ];
    
    return parts.join(', ');
  }

  /**
   * Log capabilities to console
   */
  static logCapabilities(): void {
    const caps = this.getCapabilities();
    console.log('🔍 Environment Capabilities:', {
      environment: caps.environment,
      concurrency: caps.concurrency,
      webWorkers: caps.webWorkers,
      nodeWorkers: caps.nodeWorkers,
      indexedDB: caps.indexedDB,
      recommendedWorkers: this.getRecommendedWorkerCount(),
    });
  }
}
