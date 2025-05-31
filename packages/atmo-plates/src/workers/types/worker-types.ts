/**
 * Type definitions for Web Workers
 */

export interface WorkerMessage {
  plateId: string;
  planetRadius: number;
  resolution: number;
  universeId: string;
  dontClear: boolean;
  timestamp: number;
  testMode?: boolean;
}

export interface WorkerResponse {
  success: boolean;
  plateId?: string;
  plateletCount?: number;
  plateletIds?: string[];
  message?: string;
  error?: string;
  timestamp?: number;
  usedMultiverse?: boolean;
  dontClearMode?: boolean;
  dataSource?: string;
  cellsProcessed?: number;
  validCells?: number;
}

export interface GridDiskComputationResult {
  plateId: string;
  plateletCount: number;
  plateletIds: string[];
  cellsProcessed: number;
  validCells: number;
}

export interface WorkerStatus {
  enabled: boolean;
  available: boolean;
  type: 'multiverse-worker';
  dataTransfer: 'lightweight-seeds-only';
  dataSource: 'IndexSun-IndexedDB';
  universeId: string;
  dontClearMode: boolean;
  stateless: boolean;
}

export interface DexieSunWorkerOptions {
  dbName: string;
  tableName: string;
  schema: any;
  dontClear?: boolean;
}
