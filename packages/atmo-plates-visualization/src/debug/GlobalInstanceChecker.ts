/**
 * Utility to check and debug global instance management
 */

export interface GlobalInstanceInfo {
  windowProcessMonitor: boolean;
  windowReactProcessMonitor: boolean;
  stateManagerExists: boolean;
  processTableExists: boolean;
  messageInterceptorExists: boolean;
  instanceIds: {
    processMonitor?: string;
    stateManager?: string;
    processTable?: string;
  };
  timestamp: Date;
}

export class GlobalInstanceChecker {
  private static instanceCounter = 0;

  /**
   * Generate a unique instance ID for tracking
   */
  public static generateInstanceId(type: string): string {
    return `${type}-${++this.instanceCounter}-${Date.now()}`;
  }

  /**
   * Check the current state of global instances
   */
  public static checkGlobalInstances(): GlobalInstanceInfo {
    const windowObj = typeof window !== 'undefined' ? window : {};
    const processMonitor = (windowObj as any).processMonitor;
    const reactProcessMonitor = (windowObj as any).reactProcessMonitor;

    return {
      windowProcessMonitor: !!processMonitor,
      windowReactProcessMonitor: !!reactProcessMonitor,
      stateManagerExists: !!(processMonitor?.getStateManager),
      processTableExists: !!(processMonitor?.getProcessTable),
      messageInterceptorExists: !!(processMonitor?.getMessageInterceptor),
      instanceIds: {
        processMonitor: processMonitor?._instanceId,
        stateManager: processMonitor?.getStateManager()?._instanceId,
        processTable: processMonitor?.getProcessTable()?._instanceId,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Log detailed information about global instances
   */
  public static logGlobalInstances(): void {
    const info = this.checkGlobalInstances();
    
    console.group('🔍 Global Instance Status');
    console.log('📊 Instance Info:', info);
    
    if (info.windowProcessMonitor) {
      console.log('✅ window.processMonitor exists');
      const monitor = (window as any).processMonitor;
      console.log('   - Instance ID:', monitor._instanceId || 'Not set');
      console.log('   - State Manager:', !!monitor.getStateManager);
      console.log('   - Process Table:', !!monitor.getProcessTable);
      console.log('   - Message Interceptor:', !!monitor.getMessageInterceptor);
      
      if (monitor.getStateManager) {
        const stateManager = monitor.getStateManager();
        console.log('   - State Manager ID:', stateManager._instanceId || 'Not set');
        const state = stateManager.getState();
        console.log('   - Processes:', Object.keys(state.processes).length);
        console.log('   - Tasks:', Object.keys(state.pendingTasks).length);
      }
    } else {
      console.log('❌ window.processMonitor does not exist');
    }
    
    if (info.windowReactProcessMonitor) {
      console.log('✅ window.reactProcessMonitor exists');
    } else {
      console.log('❌ window.reactProcessMonitor does not exist');
    }
    
    console.groupEnd();
  }

  /**
   * Verify that there's only one instance of each component
   */
  public static verifySingleInstances(): boolean {
    const info = this.checkGlobalInstances();
    
    // Check for duplicate instances
    const issues: string[] = [];
    
    if (!info.windowProcessMonitor) {
      issues.push('No global ProcessMonitor found');
    }
    
    if (info.windowProcessMonitor && !info.stateManagerExists) {
      issues.push('ProcessMonitor exists but StateManager is missing');
    }
    
    if (info.windowProcessMonitor && !info.processTableExists) {
      issues.push('ProcessMonitor exists but ProcessTable is missing');
    }
    
    if (issues.length > 0) {
      console.error('🚨 Global Instance Issues:', issues);
      return false;
    }
    
    console.log('✅ Global instance verification passed');
    return true;
  }

  /**
   * Add instance tracking to objects
   */
  public static addInstanceTracking(obj: any, type: string): void {
    if (obj && typeof obj === 'object') {
      obj._instanceId = this.generateInstanceId(type);
      obj._createdAt = new Date();
    }
  }

  /**
   * Monitor for duplicate instances
   */
  public static startDuplicateInstanceMonitoring(): () => void {
    let lastInfo = this.checkGlobalInstances();
    
    const interval = setInterval(() => {
      const currentInfo = this.checkGlobalInstances();
      
      // Check for changes that might indicate duplicate instances
      if (currentInfo.instanceIds.processMonitor !== lastInfo.instanceIds.processMonitor) {
        console.warn('🚨 ProcessMonitor instance ID changed!', {
          old: lastInfo.instanceIds.processMonitor,
          new: currentInfo.instanceIds.processMonitor,
        });
      }
      
      if (currentInfo.instanceIds.stateManager !== lastInfo.instanceIds.stateManager) {
        console.warn('🚨 StateManager instance ID changed!', {
          old: lastInfo.instanceIds.stateManager,
          new: currentInfo.instanceIds.stateManager,
        });
      }
      
      lastInfo = currentInfo;
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }

  /**
   * Force cleanup of all global instances
   */
  public static forceCleanup(): void {
    if (typeof window !== 'undefined') {
      const windowObj = window as any;
      
      // Cleanup ProcessMonitor
      if (windowObj.processMonitor && windowObj.processMonitor.destroy) {
        windowObj.processMonitor.destroy();
      }
      delete windowObj.processMonitor;
      
      // Cleanup React ProcessMonitor
      if (windowObj.reactProcessMonitor && windowObj.reactProcessMonitor.unmount) {
        windowObj.reactProcessMonitor.unmount();
      }
      delete windowObj.reactProcessMonitor;
      
      console.log('🧹 Forced cleanup of all global instances');
    }
  }

  /**
   * Initialize monitoring and debugging
   */
  public static initializeDebugging(): () => void {
    console.log('🔧 Initializing global instance debugging');
    
    // Log initial state
    this.logGlobalInstances();
    
    // Start monitoring
    const stopMonitoring = this.startDuplicateInstanceMonitoring();
    
    // Add global debugging functions
    if (typeof window !== 'undefined') {
      const windowObj = window as any;
      windowObj.debugGlobalInstances = () => this.logGlobalInstances();
      windowObj.verifyGlobalInstances = () => this.verifySingleInstances();
      windowObj.cleanupGlobalInstances = () => this.forceCleanup();
    }
    
    return stopMonitoring;
  }
}

// Auto-initialize debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Wait a bit for other modules to initialize
  setTimeout(() => {
    GlobalInstanceChecker.initializeDebugging();
  }, 2000);
}
