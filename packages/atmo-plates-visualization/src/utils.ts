// Browser-only logging using localStorage with chunking and debouncing
class BrowserLogBuffer {
  private readonly baseStorageKey = 'atmo-viz-debug-logs';
  private readonly maxLinesPerChunk = 1000;
  private readonly batchSize = 10; // Write every 10 lines
  private currentChunk = 0;
  private pendingLogs: string[] = [];
  private writeTimeout: number | null = null;

  constructor() {
    // Clear logs on startup and reset to chunk 0
    this.clear();

    // Ensure any pending logs are written before page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  add(data: any[]) {
    if (typeof localStorage === 'undefined') return;

    const timestamp = new Date().toISOString();
    const message = this.formatMessage(data);
    const logEntry = `[${timestamp}] ${message}`;

    // Add to pending batch
    this.pendingLogs.push(logEntry);

    // Write immediately if batch is full, otherwise debounce
    if (this.pendingLogs.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleWrite();
    }
  }

  private scheduleWrite() {
    // Clear existing timeout
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    // Schedule write after 1 second of inactivity
    this.writeTimeout = window.setTimeout(() => {
      this.flush();
    }, 1000);
  }

  private flush() {
    if (this.pendingLogs.length === 0) return;

    try {
      const currentKey = `${this.baseStorageKey}-${this.currentChunk}`;
      const existingLogs = localStorage.getItem(currentKey) || '';
      const existingLines = existingLogs
        .split('\n')
        .filter((line) => line.trim());

      // Check if adding pending logs would exceed chunk limit
      if (
        existingLines.length + this.pendingLogs.length >
        this.maxLinesPerChunk
      ) {
        // Split across chunks
        const remainingSpace = this.maxLinesPerChunk - existingLines.length;

        if (remainingSpace > 0) {
          // Fill current chunk
          const logsForCurrentChunk = this.pendingLogs.slice(0, remainingSpace);
          const updatedLogs =
            existingLogs + logsForCurrentChunk.join('\n') + '\n';
          localStorage.setItem(currentKey, updatedLogs);
        }

        // Move to next chunk for remaining logs
        this.currentChunk++;
        const newKey = `${this.baseStorageKey}-${this.currentChunk}`;
        const remainingLogs = this.pendingLogs.slice(remainingSpace);
        if (remainingLogs.length > 0) {
          localStorage.setItem(newKey, remainingLogs.join('\n') + '\n');
        }

        console.debug(
          `📦 Started new log chunk: ${newKey} (${remainingLogs.length} lines)`,
        );
      } else {
        // All logs fit in current chunk
        const updatedLogs = existingLogs + this.pendingLogs.join('\n') + '\n';
        localStorage.setItem(currentKey, updatedLogs);
      }

      // Update metadata
      const timestamp = new Date().toISOString();
      localStorage.setItem(
        `${this.baseStorageKey}-meta`,
        JSON.stringify({
          currentChunk: this.currentChunk,
          totalChunks: this.currentChunk + 1,
          lastUpdated: timestamp,
          lastBatchSize: this.pendingLogs.length,
        }),
      );

      // Clear pending logs
      this.pendingLogs = [];

      // Clear timeout
      if (this.writeTimeout) {
        clearTimeout(this.writeTimeout);
        this.writeTimeout = null;
      }
    } catch (error) {
      // Storage quota exceeded or other error
      console.warn('Failed to store log batch:', error);
      this.pendingLogs = []; // Clear to prevent memory buildup
    }
  }

  private formatMessage(data: any[]): string {
    return data
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        } else if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        } else if (item === null) {
          return 'null';
        } else if (item === undefined) {
          return 'undefined';
        } else if (typeof item === 'object') {
          return JSON.stringify(item, null, 2);
        } else {
          return String(item);
        }
      })
      .join(' ');
  }

  clear() {
    if (typeof localStorage === 'undefined') return;

    // Get current metadata to know how many chunks to clear
    const metaStr = localStorage.getItem(`${this.baseStorageKey}-meta`);
    let totalChunks = 1;

    if (metaStr) {
      try {
        const meta = JSON.parse(metaStr);
        totalChunks = meta.totalChunks || 1;
      } catch {}
    }

    // Remove all chunks
    for (let i = 0; i < totalChunks; i++) {
      localStorage.removeItem(`${this.baseStorageKey}-${i}`);
    }

    // Remove metadata
    localStorage.removeItem(`${this.baseStorageKey}-meta`);

    // Reset to chunk 0
    this.currentChunk = 0;
  }

  export(): string {
    if (typeof localStorage === 'undefined') return '';

    const metaStr = localStorage.getItem(`${this.baseStorageKey}-meta`);
    let totalChunks = 1;

    if (metaStr) {
      try {
        const meta = JSON.parse(metaStr);
        totalChunks = meta.totalChunks || 1;
      } catch {}
    }

    let allLogs = '';

    // Combine all chunks in order
    for (let i = 0; i < totalChunks; i++) {
      const chunkKey = `${this.baseStorageKey}-${i}`;
      const chunkData = localStorage.getItem(chunkKey) || '';
      allLogs += chunkData;
    }

    return allLogs;
  }

  download(filename?: string) {
    const logs = this.export();
    if (!logs) {
      console.log('📝 No logs to download');
      return;
    }

    const defaultFilename = `atmo-viz-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

const browserBuffer = new BrowserLogBuffer();

export function log(...data: any[]) {
  // Store in localStorage buffer (keeps console clean!)
  browserBuffer.add(data);

  // Only show in console if debug mode is enabled
  if (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('atmo-viz-debug') === 'true'
  ) {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}]`, ...data);
  }
}

// Export debug utilities for browser use
export const debugUtils = {
  // Enable console output
  enableConsole: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('atmo-viz-debug', 'true');
      console.log('🔧 Visualization console debug output enabled');
    }
  },

  // Disable console output
  disableConsole: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('atmo-viz-debug');
      console.log('🔇 Visualization console debug output disabled');
    }
  },

  // Download logs as file
  downloadLogs: () => browserBuffer.download(),

  // Clear the log buffer
  clearLogs: () => {
    browserBuffer.clear();
    console.log('🧹 Visualization logs cleared');
  },

  // View raw logs in console
  viewRawLogs: () => {
    const logs = browserBuffer.export();
    console.log('📝 Raw logs:\n', logs);
  },
};
