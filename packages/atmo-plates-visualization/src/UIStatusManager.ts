export interface WorkerStatus {
  enabled: boolean;
  available: boolean;
  type?: string;
  dataTransfer?: string;
  dataSource?: string;
  universeId?: string;
  dontClearMode?: boolean;
  stateless?: boolean;
}

export interface PerformanceMetrics {
  generationTime: number;
  plateletCount: number;
}

export interface StorageInfo {
  type: string;
  status: 'success' | 'error' | 'warning';
}

export class UIStatusManager {
  private static readonly COLOR_SUCCESS = '#4CAF50';
  private static readonly COLOR_WARNING = '#FFC107';
  private static readonly COLOR_ERROR = '#F44336';
  private static readonly COLOR_DISABLED = '#9E9E9E';

  /**
   * Updates the worker status display element
   */
  public static updateWorkerStatus(workerStatus: WorkerStatus): void {
    // Update DOM element if it exists
    const workerStatusElement = document.getElementById('worker-status');
    if (workerStatusElement) {
      if (workerStatus.enabled && workerStatus.available) {
        workerStatusElement.textContent = 'Enabled (IDBSun Worker Engine)';
        workerStatusElement.style.color = this.COLOR_SUCCESS;
      } else if (workerStatus.enabled && !workerStatus.available) {
        workerStatusElement.textContent =
          'Enabled but unavailable (Fallback to main thread)';
        workerStatusElement.style.color = this.COLOR_WARNING;
      } else {
        workerStatusElement.textContent = 'Disabled (Using main thread only)';
        workerStatusElement.style.color = this.COLOR_DISABLED;
      }
    }

    // Update React table if it exists
    this.updateReactTable({ worker: workerStatus });
  }

  /**
   * Updates the storage type display element
   */
  public static updateStorageType(storageInfo: StorageInfo): void {
    // Update DOM element if it exists
    const storageTypeElement = document.getElementById('storage-type');
    if (storageTypeElement) {
      storageTypeElement.textContent = storageInfo.type;

      switch (storageInfo.status) {
        case 'success':
          storageTypeElement.style.color = this.COLOR_SUCCESS;
          break;
        case 'warning':
          storageTypeElement.style.color = this.COLOR_WARNING;
          break;
        case 'error':
          storageTypeElement.style.color = this.COLOR_ERROR;
          break;
      }
    }

    // Update React table if it exists
    this.updateReactTable({ storage: storageInfo });
  }

  /**
   * Updates the performance metrics display elements
   */
  public static updatePerformanceMetrics(metrics: PerformanceMetrics): void {
    this.updateGenerationTime(metrics.generationTime);
    this.updatePlateletCount(metrics.plateletCount);

    // Update React table if it exists
    this.updateReactTable({ performance: metrics });
  }

  /**
   * Updates the generation time display element
   */
  private static updateGenerationTime(generationTime: number): void {
    const generationTimeElement = document.getElementById('generation-time');
    if (!generationTimeElement) return;

    generationTimeElement.textContent = `${generationTime.toFixed(2)} ms`;

    // Color based on performance (green for fast, yellow for medium, red for slow)
    if (generationTime < 5000) {
      generationTimeElement.style.color = this.COLOR_SUCCESS;
    } else if (generationTime < 15000) {
      generationTimeElement.style.color = this.COLOR_WARNING;
    } else {
      generationTimeElement.style.color = this.COLOR_ERROR;
    }
  }

  /**
   * Updates the platelet count display element
   */
  private static updatePlateletCount(plateletCount: number): void {
    const plateletCountElement = document.getElementById('platelet-count');
    if (!plateletCountElement) return;

    plateletCountElement.textContent = plateletCount.toString();
  }

  /**
   * Shows an error screen with the provided error information
   */
  public static showErrorScreen(error: Error): void {
    // Update storage info to show error
    this.updateStorageType({
      type: 'Error: Failed to initialize IDBSun',
      status: 'error',
    });

    // Show error on screen
    document.body.innerHTML = `
      <div style="color: red; font-family: monospace; padding: 20px; background: black;">
        <h1>Visualization Error</h1>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Storage:</strong> Failed to initialize IDBSun</p>
        <pre>${error.stack}</pre>
      </div>
    `;
  }

  /**
   * Convenience method to update all status elements at once
   */
  public static updateAllStatus(data: {
    workerStatus?: WorkerStatus;
    storageInfo?: StorageInfo;
    performanceMetrics?: PerformanceMetrics;
  }): void {
    if (data.workerStatus) {
      this.updateWorkerStatus(data.workerStatus);
    }

    if (data.storageInfo) {
      this.updateStorageType(data.storageInfo);
    }

    if (data.performanceMetrics) {
      this.updatePerformanceMetrics(data.performanceMetrics);
    }
  }

  /**
   * Clears all status displays
   */
  public static clearAllStatus(): void {
    const elementIds = [
      'worker-status',
      'storage-type',
      'generation-time',
      'platelet-count',
    ];

    elementIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '';
        element.style.color = '';
      }
    });
  }

  /**
   * Checks if all required UI elements exist in the DOM
   */
  public static validateUIElements(): { missing: string[]; present: string[] } {
    const requiredIds = [
      'worker-status',
      'storage-type',
      'generation-time',
      'platelet-count',
    ];
    const missing: string[] = [];
    const present: string[] = [];

    requiredIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        present.push(id);
      } else {
        missing.push(id);
      }
    });

    return { missing, present };
  }

  /**
   * Updates the React table component if it exists
   */
  private static updateReactTable(updates: any): void {
    const updateFunction = (window as any).updateStatusTable;
    if (updateFunction && typeof updateFunction === 'function') {
      updateFunction(updates);
    }
  }

  /**
   * Initializes React table integration
   */
  public static initializeReactTable(): void {
    // This method can be called to ensure React table integration is set up
    // The actual integration happens when the React component mounts
  }
}
