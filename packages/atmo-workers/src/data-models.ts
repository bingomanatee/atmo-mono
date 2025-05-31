/**
 * Minimal Data Models for POC
 */

// ─── Core Models ───────────────────────────────────────────────────

export interface Bank {
  bankId: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface Task {
  taskId: string;
  name: string;
}

export interface Request {
  requestId: string;
  taskId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  clientId: string;
  maxTime: number; // Maximum time in milliseconds
  result?: any;
  error?: string;
}

// ─── System Metrics ────────────────────────────────────────────────

export interface SystemMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  activeBanks: number;
}
