export interface ProcessInfo {
  id: string;
  type: 'platelet-generation' | 'neighbor-processing' | 'edge-detection' | 'visualization';
  status: 'pending' | 'running' | 'completed' | 'failed';
  plateId?: string;
  startTime?: Date;
  endTime?: Date;
  progress?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface PendingTask {
  id: string;
  type: string;
  priority: number;
  plateId?: string;
  queuedAt: Date;
  estimatedDuration?: number;
  dependencies?: string[];
}
