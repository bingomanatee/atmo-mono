// Environment detection
const isNode =
  typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined';

// Browser logging using localStorage with chunking and debouncing for performance
class BrowserLogBuffer {
  private readonly baseStorageKey = 'atmo-debug-logs';
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
      // Try to clear oldest chunk and retry
      this.clearOldestChunk();
      try {
        const currentKey = `${this.baseStorageKey}-${this.currentChunk}`;
        localStorage.setItem(currentKey, this.pendingLogs.join('\n') + '\n');
        this.pendingLogs = [];
      } catch (retryError) {
        console.warn('Unable to store logs in localStorage');
        this.pendingLogs = []; // Clear to prevent memory buildup
      }
    }
  }

  private clearOldestChunk() {
    const meta = this.getMeta();
    if (meta.totalChunks > 1) {
      // Remove chunk 0 and shift everything down
      localStorage.removeItem(`${this.baseStorageKey}-0`);

      // Shift all chunks down by 1
      for (let i = 1; i < meta.totalChunks; i++) {
        const oldKey = `${this.baseStorageKey}-${i}`;
        const newKey = `${this.baseStorageKey}-${i - 1}`;
        const data = localStorage.getItem(oldKey);
        if (data) {
          localStorage.setItem(newKey, data);
          localStorage.removeItem(oldKey);
        }
      }

      this.currentChunk = Math.max(0, this.currentChunk - 1);
      console.debug('🗑️ Cleared oldest log chunk to make space');
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

  private getMeta() {
    if (typeof localStorage === 'undefined') {
      return { currentChunk: 0, totalChunks: 1, lastUpdated: '' };
    }

    const metaStr = localStorage.getItem(`${this.baseStorageKey}-meta`);
    if (!metaStr) {
      return { currentChunk: 0, totalChunks: 1, lastUpdated: '' };
    }

    try {
      return JSON.parse(metaStr);
    } catch {
      return { currentChunk: 0, totalChunks: 1, lastUpdated: '' };
    }
  }

  export(): string {
    if (typeof localStorage === 'undefined') return '';

    const meta = this.getMeta();
    let allLogs = '';

    // Combine all chunks in order
    for (let i = 0; i < meta.totalChunks; i++) {
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

    const meta = this.getMeta();
    const defaultFilename = `atmo-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-${meta.totalChunks}chunks.log`;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  clear() {
    if (typeof localStorage === 'undefined') return;

    const meta = this.getMeta();

    // Remove all chunks
    for (let i = 0; i < meta.totalChunks; i++) {
      localStorage.removeItem(`${this.baseStorageKey}-${i}`);
    }

    // Remove metadata
    localStorage.removeItem(`${this.baseStorageKey}-meta`);

    // Reset to chunk 0
    this.currentChunk = 0;
  }

  view() {
    const logs = this.export();
    if (!logs) {
      console.log('📝 No logs to display');
      return;
    }

    const lines = logs.split('\n').filter((line) => line.trim());
    const recentLines = lines.slice(-50); // Show last 50 entries
    const meta = this.getMeta();

    console.table(
      recentLines.map((line, index) => {
        const match = line.match(/^\[([^\]]+)\] (.+)$/);
        if (match) {
          return {
            Index: lines.length - 50 + index,
            Time: match[1].slice(11, 19), // Just show time part
            Message:
              match[2].slice(0, 100) + (match[2].length > 100 ? '...' : ''),
          };
        }
        return { Index: index, Time: '', Message: line };
      }),
    );

    if (lines.length > 50) {
      console.log(
        `📝 Showing last 50 of ${lines.length} total log entries across ${meta.totalChunks} chunks`,
      );
    }
  }

  getStats() {
    const logs = this.export();
    const lines = logs.split('\n').filter((line) => line.trim());
    const sizeKB = Math.round(logs.length / 1024);
    const meta = this.getMeta();

    return {
      totalEntries: lines.length,
      totalChunks: meta.totalChunks,
      currentChunk: meta.currentChunk,
      linesPerChunk: this.maxLinesPerChunk,
      storageSizeKB: sizeKB,
      lastUpdated: meta.lastUpdated,
      oldest: lines[0]?.match(/^\[([^\]]+)\]/)?.[1],
      newest: lines[lines.length - 1]?.match(/^\[([^\]]+)\]/)?.[1],
    };
  }

  // Direct access to raw logs string
  getRawLogs(): string {
    return this.export();
  }

  // Get specific chunk (useful for debugging)
  getChunk(chunkIndex: number): string {
    if (typeof localStorage === 'undefined') return '';
    const chunkKey = `${this.baseStorageKey}-${chunkIndex}`;
    return localStorage.getItem(chunkKey) || '';
  }

  // List all available chunks
  listChunks(): string[] {
    if (typeof localStorage === 'undefined') return [];

    const chunks: string[] = [];
    const meta = this.getMeta();

    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkKey = `${this.baseStorageKey}-${i}`;
      if (localStorage.getItem(chunkKey)) {
        chunks.push(chunkKey);
      }
    }

    return chunks;
  }
}

const browserBuffer = new BrowserLogBuffer();

// Only import Node.js modules if we're in Node.js environment
let fs: any = null;
let path: any = null;

if (isNode) {
  try {
    fs = require('fs');
    path = require('path');
  } catch (error) {
    // Fallback if modules aren't available
  }
}

// Find the atmo-plates directory and save log there (Node.js only)
function getAtmoPlatesLogPath(): string | null {
  // Double-check we're in Node.js environment with all required APIs
  if (!isNode || !path || typeof process === 'undefined' || !process.cwd) {
    return null; // Browser environment or missing Node.js APIs
  }

  try {
    const cwd = process.cwd();
    const pathParts = cwd.split(path.sep);

    // Find the index of 'atmo-plates' in the path
    const atmoPlatesIndex = pathParts.findIndex(
      (part: string) => part === 'atmo-plates',
    );

    if (atmoPlatesIndex !== -1) {
      // Reconstruct path up to and including 'atmo-plates'
      const atmoPlatesPath = pathParts
        .slice(0, atmoPlatesIndex + 1)
        .join(path.sep);
      return path.join(atmoPlatesPath, 'debug.log');
    }

    // Fallback: use current working directory if atmo-plates not found
    return path.join(cwd, 'debug.log');
  } catch (error) {
    return null;
  }
}

// Initialize Node.js logging only in Node.js environment
let LOG_FILE_PATH: string | null = null;

if (isNode) {
  LOG_FILE_PATH = getAtmoPlatesLogPath();

  // Clear the log file at module bootup (Node.js only)
  if (LOG_FILE_PATH && fs) {
    try {
      fs.writeFileSync(LOG_FILE_PATH, '', 'utf8');
    } catch (error) {
      // Ignore errors during bootup clearing
    }
  }
}

export function log(...data: any[]) {
  // In browser environment, use the buffer (keeps console clean!)
  if (isBrowser) {
    browserBuffer.add(data);
    // Only show in console if debug mode is enabled
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('atmo-debug') === 'true'
    ) {
      const timestamp = new Date().toISOString();
      console.debug(`[${timestamp}]`, ...data);
    }
    return;
  }

  // In Node.js environment, format and write to file
  const timestamp = new Date().toISOString();
  const message = data
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

  const logEntry = `[${timestamp}] ${message}`;

  if (LOG_FILE_PATH && fs) {
    try {
      fs.appendFileSync(LOG_FILE_PATH, logEntry + '\n', 'utf8');
    } catch (error) {
      // Fallback to console if file operations fail
      console.error('Failed to write to log file:', error);
      console.log(logEntry);
    }
  } else {
    // Fallback to console if no file path or fs available
    console.log(logEntry);
  }
}

// Export debug utilities for browser use
export const debugUtils = {
  // Enable console output in browser
  enableConsole: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('atmo-debug', 'true');
      console.log('🔧 Console debug output enabled');
    }
  },

  // Disable console output in browser
  disableConsole: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('atmo-debug');
      console.log('🔇 Console debug output disabled');
    }
  },

  // Download logs as file
  downloadLogs: () => {
    if (isBrowser) {
      browserBuffer.download();
    } else {
      console.log('Download only available in browser environment');
    }
  },

  // Clear the log buffer
  clearLogs: () => {
    if (isBrowser) {
      browserBuffer.clear();
      console.log('🧹 Browser logs cleared');
    } else {
      console.log('Clear only available in browser environment');
    }
  },

  // View logs in console table
  viewLogs: () => {
    if (isBrowser) {
      browserBuffer.view();
    } else {
      console.log('View only available in browser environment');
    }
  },

  // Get log statistics
  getStats: () => {
    if (isBrowser) {
      const stats = browserBuffer.getStats();
      console.log('📊 Log Statistics:', stats);
      return stats;
    } else {
      console.log('Stats only available in browser environment');
      return null;
    }
  },
};
