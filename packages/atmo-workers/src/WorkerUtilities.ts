/**
 * WorkerUtilities - Injectable utilities for WorkerResponder
 * These can be mocked with MSW or other testing tools
 */
import { BrowserWorkerManager } from './BrowserWorkerManager';
import { MockWorkerManager } from './MockWorkerManager';

export interface HttpClient {
  get(url: string, options?: RequestInit): Promise<Response>;
  post(url: string, body?: any, options?: RequestInit): Promise<Response>;
  put(url: string, body?: any, options?: RequestInit): Promise<Response>;
  delete(url: string, options?: RequestInit): Promise<Response>;
}

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

export interface Database {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ affectedRows: number }>;
  transaction<T>(callback: (db: Database) => Promise<T>): Promise<T>;
}

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface WorkerManager {
  createWorker(scriptUrl: string): Worker | any;
  terminateWorker(worker: Worker | any): void;
  postMessage(worker: Worker | any, message: any): void;
  addEventListener(
    worker: Worker | any,
    type: string,
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    worker: Worker | any,
    type: string,
    listener: (event: MessageEvent) => void,
  ): void;
}

export interface WorkerUtilities {
  http: HttpClient;
  fs: FileSystem;
  db: Database;
  logger: Logger;
  worker: WorkerManager;
}

// ─── Default Implementations ───────────────────────────────────────────

export class FetchHttpClient implements HttpClient {
  async get(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, { ...options, method: 'GET' });
  }

  async post(
    url: string,
    body?: any,
    options?: RequestInit,
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    });
  }

  async put(url: string, body?: any, options?: RequestInit): Promise<Response> {
    return fetch(url, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    });
  }

  async delete(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, { ...options, method: 'DELETE' });
  }
}

export class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content, 'utf-8');
  }

  async exists(path: string): Promise<boolean> {
    const fs = await import('fs/promises');
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.mkdir(path, { recursive: true });
  }
}

export class ConsoleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`ℹ️ ${message}`, meta ? JSON.stringify(meta) : '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`⚠️ ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, meta?: any): void {
    console.error(`❌ ${message}`, meta ? JSON.stringify(meta) : '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`🐛 ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

export class MockDatabase implements Database {
  private data = new Map<string, any[]>();

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Simple mock - just return empty array
    console.log(`🗄️ Mock DB Query: ${sql}`, params);
    return [];
  }

  async execute(
    sql: string,
    params?: any[],
  ): Promise<{ affectedRows: number }> {
    console.log(`🗄️ Mock DB Execute: ${sql}`, params);
    return { affectedRows: 1 };
  }

  async transaction<T>(callback: (db: Database) => Promise<T>): Promise<T> {
    console.log(`🗄️ Mock DB Transaction`);
    return callback(this);
  }
}

// ─── Worker Manager Implementations ────────────────────────────────────

// ─── Factory Function ──────────────────────────────────────────────────

export function createDefaultUtilities(): WorkerUtilities {
  // Detect environment and choose appropriate worker manager
  const workerManager =
    typeof Worker !== 'undefined'
      ? new BrowserWorkerManager()
      : new MockWorkerManager();

  return {
    http: new FetchHttpClient(),
    fs: new NodeFileSystem(),
    db: new MockDatabase(),
    logger: new ConsoleLogger(),
    worker: workerManager,
  };
}

export function createTestUtilities(): WorkerUtilities {
  return {
    http: new FetchHttpClient(),
    fs: new NodeFileSystem(),
    db: new MockDatabase(),
    logger: new ConsoleLogger(),
    worker: new MockWorkerManager(),
  };
}
