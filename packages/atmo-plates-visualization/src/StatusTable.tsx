import React, { useState, useEffect } from 'react';
import { WorkerStatus, PerformanceMetrics, StorageInfo } from './UIStatusManager';

interface StatusTableProps {
  className?: string;
  style?: React.CSSProperties;
}

interface StatusData {
  storage: StorageInfo;
  worker: WorkerStatus;
  performance: PerformanceMetrics;
  lastUpdated: Date;
}

const StatusTable: React.FC<StatusTableProps> = ({ className, style }) => {
  const [statusData, setStatusData] = useState<StatusData>({
    storage: { type: 'Initializing...', status: 'warning' },
    worker: { enabled: false, available: false },
    performance: { generationTime: 0, plateletCount: 0 },
    lastUpdated: new Date(),
  });

  // Function to update status data (can be called from outside)
  const updateStatus = (updates: Partial<StatusData>) => {
    setStatusData(prev => ({
      ...prev,
      ...updates,
      lastUpdated: new Date(),
    }));
  };

  // Expose update function globally for integration with existing code
  useEffect(() => {
    (window as any).updateStatusTable = updateStatus;
    return () => {
      delete (window as any).updateStatusTable;
    };
  }, []);

  const getStatusColor = (status: 'success' | 'error' | 'warning') => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FFC107';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getWorkerStatusText = (worker: WorkerStatus) => {
    if (worker.enabled && worker.available) {
      return 'Enabled (IDBSun Worker Engine)';
    } else if (worker.enabled && !worker.available) {
      return 'Enabled but unavailable (Fallback to main thread)';
    } else {
      return 'Disabled (Using main thread only)';
    }
  };

  const getWorkerStatusColor = (worker: WorkerStatus) => {
    if (worker.enabled && worker.available) {
      return '#4CAF50';
    } else if (worker.enabled && !worker.available) {
      return '#FFC107';
    } else {
      return '#9E9E9E';
    }
  };

  const getPerformanceColor = (generationTime: number) => {
    if (generationTime < 5000) return '#4CAF50';
    if (generationTime < 15000) return '#FFC107';
    return '#F44336';
  };

  const tableStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    borderRadius: '8px',
    padding: '12px',
    zIndex: 1000,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    minWidth: '300px',
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
    paddingBottom: '4px',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: '500',
    minWidth: '120px',
  };

  const valueStyle: React.CSSProperties = {
    textAlign: 'right',
    flex: 1,
  };

  return (
    <div className={className} style={tableStyle}>
      <div style={headerStyle}>
        Platelet Visualization Status
      </div>
      
      <div style={rowStyle}>
        <span style={labelStyle}>Storage:</span>
        <span 
          style={{
            ...valueStyle,
            color: getStatusColor(statusData.storage.status),
          }}
        >
          {statusData.storage.type}
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Workers:</span>
        <span 
          style={{
            ...valueStyle,
            color: getWorkerStatusColor(statusData.worker),
          }}
        >
          {getWorkerStatusText(statusData.worker)}
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Generation Time:</span>
        <span 
          style={{
            ...valueStyle,
            color: getPerformanceColor(statusData.performance.generationTime),
          }}
        >
          {statusData.performance.generationTime.toFixed(2)} ms
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Platelets:</span>
        <span style={valueStyle}>
          {statusData.performance.plateletCount.toLocaleString()}
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Last Updated:</span>
        <span style={{...valueStyle, fontSize: '12px', opacity: 0.8}}>
          {statusData.lastUpdated.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default StatusTable;

// Helper function to integrate with existing UIStatusManager
export const integrateWithUIStatusManager = () => {
  const updateTable = (window as any).updateStatusTable;
  if (!updateTable) return;

  // Override UIStatusManager methods to also update React table
  const originalUpdateStorageType = (window as any).UIStatusManager?.updateStorageType;
  const originalUpdateWorkerStatus = (window as any).UIStatusManager?.updateWorkerStatus;
  const originalUpdatePerformanceMetrics = (window as any).UIStatusManager?.updatePerformanceMetrics;

  if (originalUpdateStorageType) {
    (window as any).UIStatusManager.updateStorageType = (storageInfo: StorageInfo) => {
      originalUpdateStorageType(storageInfo);
      updateTable({ storage: storageInfo });
    };
  }

  if (originalUpdateWorkerStatus) {
    (window as any).UIStatusManager.updateWorkerStatus = (workerStatus: WorkerStatus) => {
      originalUpdateWorkerStatus(workerStatus);
      updateTable({ worker: workerStatus });
    };
  }

  if (originalUpdatePerformanceMetrics) {
    (window as any).UIStatusManager.updatePerformanceMetrics = (metrics: PerformanceMetrics) => {
      originalUpdatePerformanceMetrics(metrics);
      updateTable({ performance: metrics });
    };
  }
};
