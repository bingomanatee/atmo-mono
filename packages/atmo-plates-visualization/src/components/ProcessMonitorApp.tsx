import React, { useState, useCallback } from 'react';
import ProcessTable from './ProcessTable';
import type { ProcessInfo, PendingTask } from '../types/process';
import { useProcessMonitor } from '../hooks/useProcessMonitor';

interface ProcessMonitorAppProps {
  className?: string;
  style?: React.CSSProperties;
  showControls?: boolean;
  showStatusInfo?: boolean;
}

const ProcessMonitorApp: React.FC<ProcessMonitorAppProps> = ({
  className,
  style,
  showControls = true,
  showStatusInfo = true,
}) => {
  const [appState, stateManager] = useProcessMonitor();

  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(
    null,
  );
  const [selectedTask, setSelectedTask] = useState<PendingTask | null>(null);
  const [isTableVisible, setIsTableVisible] = useState(true);

  const handleProcessClick = useCallback((process: ProcessInfo) => {
    setSelectedProcess(process);
    console.log('Selected process:', process);
  }, []);

  const handleTaskClick = useCallback((task: PendingTask) => {
    setSelectedTask(task);
    console.log('Selected task:', task);
  }, []);

  const handleSimulateActivity = useCallback(() => {
    // Add some test data using the state manager directly
    setTimeout(() => {
      stateManager.appState.acts.addProcess({
        id: `process-${Date.now()}`,
        type: 'platelet-generation',
        status: 'running',
        plateId: `plate-${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0')}`,
        startTime: Date.now(),
        progress: Math.random() * 0.8,
      });

      stateManager.appState.acts.addTask({
        id: `task-${Date.now()}`,
        type: 'neighbor-processing',
        priority: Math.floor(Math.random() * 3) + 1,
        plateId: `plate-${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0')}`,
        queuedAt: Date.now(),
        estimatedDuration: Math.floor(Math.random() * 5000) + 1000,
      });
    }, 500);
  }, [stateManager]);

  const controlsStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    zIndex: 1000,
  };

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(33, 150, 243, 0.8)',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    margin: '4px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: '"Courier New", monospace',
    fontSize: '12px',
    transition: 'background-color 0.2s',
  };

  const statusInfoStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '12px',
    zIndex: 1000,
    border: '1px solid rgba(255, 255, 255, 0.3)',
    fontFamily: '"Courier New", monospace',
  };

  const statusRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    margin: '4px 0',
    minWidth: '200px',
  };

  const statusLabelStyle: React.CSSProperties = {
    fontWeight: 'bold',
  };

  const statusValueStyle: React.CSSProperties = {
    color: '#4CAF50',
  };

  const errorStyle: React.CSSProperties = {
    color: '#F44336',
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '800px',
    maxHeight: '80vh',
    background: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid #333',
    borderRadius: '8px',
    zIndex: 10000,
    overflow: 'hidden',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    color: 'white',
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Process Table */}
      {isTableVisible && (
        <ProcessTable
          processes={Object.values(appState.processes)}
          tasks={Object.values(appState.pendingTasks)}
          onProcessClick={handleProcessClick}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Controls */}
      {showControls && (
        <div style={controlsStyle}>
          <button
            style={buttonStyle}
            onClick={handleSimulateActivity}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 0.8)';
            }}
          >
            Simulate Activity
          </button>

          <button
            style={buttonStyle}
            onClick={() => stateManager.clear()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 0.8)';
            }}
          >
            Clear All
          </button>

          <button
            style={buttonStyle}
            onClick={() => setIsTableVisible(!isTableVisible)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 0.8)';
            }}
          >
            {isTableVisible ? 'Hide Table' : 'Show Table'}
          </button>

          <button
            style={buttonStyle}
            onClick={() => {
              const dataStr = JSON.stringify(appState, null, 2);
              const dataBlob = new Blob([dataStr], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `process-state-${new Date().toISOString()}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(33, 150, 243, 0.8)';
            }}
          >
            Export State
          </button>
        </div>
      )}

      {/* Status Info */}
      {showStatusInfo && (
        <div style={statusInfoStyle}>
          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Monitor Status:</span>
            <span style={statusValueStyle}>Connected</span>
          </div>

          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Active Processes:</span>
            <span style={statusValueStyle}>
              {stateManager.appState.acts.getActiveProcesses().length}
            </span>
          </div>

          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Pending Tasks:</span>
            <span style={statusValueStyle}>
              {stateManager.appState.acts.getTaskCount()}
            </span>
          </div>

          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Total Platelets:</span>
            <span style={statusValueStyle}>
              {stateManager.plates.acts.getTotalPlatelets().toLocaleString()}
            </span>
          </div>

          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Completed:</span>
            <span style={statusValueStyle}>
              {stateManager.appState.acts.getCompletedProcesses().length}
            </span>
          </div>

          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Failed:</span>
            <span
              style={{
                color:
                  stateManager.appState.acts.getFailedProcesses().length > 0
                    ? '#F44336'
                    : statusValueStyle.color,
              }}
            >
              {stateManager.appState.acts.getFailedProcesses().length}
            </span>
          </div>

          <div style={statusRowStyle}>
            <span style={statusLabelStyle}>Last Updated:</span>
            <span
              style={{ ...statusValueStyle, fontSize: '11px', opacity: 0.8 }}
            >
              {new Date(appState.lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Selected Item Details (Optional) */}
      {(selectedProcess || selectedTask) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.95)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            zIndex: 2000,
            maxWidth: '400px',
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
          }}
          onClick={() => {
            setSelectedProcess(null);
            setSelectedTask(null);
          }}
        >
          <h4 style={{ margin: '0 0 12px 0', color: '#4CAF50' }}>
            {selectedProcess ? 'Process Details' : 'Task Details'}
          </h4>

          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px' }}>
            {JSON.stringify(selectedProcess || selectedTask, null, 2)}
          </pre>

          <p style={{ margin: '12px 0 0 0', fontSize: '10px', opacity: 0.7 }}>
            Click anywhere to close
          </p>
        </div>
      )}
    </div>
  );
};

export default ProcessMonitorApp;
