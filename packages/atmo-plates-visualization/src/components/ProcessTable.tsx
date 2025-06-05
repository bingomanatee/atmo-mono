import React, { useState, useEffect, useMemo } from 'react';
import type { ProcessInfo, PendingTask } from '../types/process';

interface ProcessTableProps {
  processes: ProcessInfo[];
  tasks: PendingTask[];
  onProcessClick?: (process: ProcessInfo) => void;
  onTaskClick?: (task: PendingTask) => void;
  className?: string;
  style?: React.CSSProperties;
}

const ProcessTable: React.FC<ProcessTableProps> = ({
  processes,
  tasks,
  onProcessClick,
  onTaskClick,
  className,
  style,
}) => {
  const [sortBy, setSortBy] = useState<'id' | 'type' | 'status' | 'startTime'>(
    'startTime',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [taskSortBy, setTaskSortBy] = useState<
    'priority' | 'queuedAt' | 'type'
  >('priority');

  const sortedProcesses = useMemo(() => {
    return [...processes].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];

      if (sortBy === 'startTime') {
        aVal = a.startTime?.getTime() || 0;
        bVal = b.startTime?.getTime() || 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [processes, sortBy, sortOrder]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (taskSortBy === 'priority') return b.priority - a.priority;
      if (taskSortBy === 'queuedAt')
        return a.queuedAt.getTime() - b.queuedAt.getTime();
      return a.type.localeCompare(b.type);
    });
  }, [tasks, taskSortBy]);

  const getStatusColor = (status: ProcessInfo['status']) => {
    switch (status) {
      case 'pending':
        return '#FFC107';
      case 'running':
        return '#2196F3';
      case 'completed':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getDuration = (process: ProcessInfo) => {
    if (!process.startTime) return 'N/A';
    const endTime = process.endTime || new Date();
    const duration = endTime.getTime() - process.startTime.getTime();
    return `${duration}ms`;
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    fontFamily: '"Courier New", monospace',
    fontSize: '12px',
    borderRadius: '8px',
    padding: '16px',
    zIndex: 1000,
    maxWidth: '600px',
    maxHeight: '80vh',
    overflowY: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    ...style,
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '16px',
  };

  const headerStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.1)',
    borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
  };

  const thStyle: React.CSSProperties = {
    padding: '8px',
    textAlign: 'left',
    fontWeight: 'bold',
    borderRight: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const tdStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '11px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const rowStyle: React.CSSProperties = {
    transition: 'background-color 0.2s',
    cursor: 'pointer',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: '14px',
    borderBottom: '1px solid rgba(76, 175, 80, 0.3)',
    paddingBottom: '4px',
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Active Processes Section */}
      <h3 style={{ ...sectionHeaderStyle, color: '#4CAF50' }}>
        Active Processes ({processes.length})
      </h3>

      <table style={tableStyle}>
        <thead style={headerStyle}>
          <tr>
            <th style={thStyle} onClick={() => handleSort('id')}>
              Process ID {sortBy === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={thStyle} onClick={() => handleSort('type')}>
              Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={thStyle} onClick={() => handleSort('status')}>
              Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={thStyle}>Plate ID</th>
            <th style={thStyle} onClick={() => handleSort('startTime')}>
              Duration{' '}
              {sortBy === 'startTime' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={thStyle}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {sortedProcesses.map((process) => (
            <tr
              key={process.id}
              style={rowStyle}
              onClick={() => onProcessClick?.(process)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <td style={tdStyle} title={process.id}>
                {process.id.substring(0, 8)}...
              </td>
              <td style={tdStyle}>{process.type}</td>
              <td
                style={{
                  ...tdStyle,
                  color: getStatusColor(process.status),
                  fontWeight: 'bold',
                }}
              >
                {process.status.toUpperCase()}
              </td>
              <td style={tdStyle} title={process.plateId}>
                {process.plateId
                  ? `${process.plateId.substring(0, 8)}...`
                  : 'N/A'}
              </td>
              <td style={tdStyle}>{getDuration(process)}</td>
              <td style={tdStyle}>
                {process.progress !== undefined ? (
                  <span
                    style={{
                      color:
                        process.progress < 0.5
                          ? '#FFC107'
                          : process.progress < 1
                            ? '#2196F3'
                            : '#4CAF50',
                    }}
                  >
                    {Math.round(process.progress * 100)}%
                  </span>
                ) : (
                  'N/A'
                )}
              </td>
            </tr>
          ))}
          {sortedProcesses.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{
                  ...tdStyle,
                  textAlign: 'center',
                  fontStyle: 'italic',
                  opacity: 0.7,
                }}
              >
                No active processes
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pending Tasks Section */}
      <h3
        style={{ ...sectionHeaderStyle, color: '#FFC107', marginTop: '16px' }}
      >
        Pending Tasks ({tasks.length})
      </h3>

      <table style={tableStyle}>
        <thead style={headerStyle}>
          <tr>
            <th style={thStyle}>Task ID</th>
            <th style={thStyle} onClick={() => setTaskSortBy('type')}>
              Type {taskSortBy === 'type' && '↓'}
            </th>
            <th style={thStyle} onClick={() => setTaskSortBy('priority')}>
              Priority {taskSortBy === 'priority' && '↓'}
            </th>
            <th style={thStyle}>Plate ID</th>
            <th style={thStyle} onClick={() => setTaskSortBy('queuedAt')}>
              Queued {taskSortBy === 'queuedAt' && '↑'}
            </th>
            <th style={thStyle}>Est. Duration</th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task) => (
            <tr
              key={task.id}
              style={rowStyle}
              onClick={() => onTaskClick?.(task)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <td style={tdStyle} title={task.id}>
                {task.id.substring(0, 8)}...
              </td>
              <td style={tdStyle}>{task.type}</td>
              <td
                style={{
                  ...tdStyle,
                  color:
                    task.priority > 2
                      ? '#F44336'
                      : task.priority > 1
                        ? '#FFC107'
                        : '#4CAF50',
                  fontWeight: 'bold',
                }}
              >
                {task.priority}
              </td>
              <td style={tdStyle} title={task.plateId}>
                {task.plateId ? `${task.plateId.substring(0, 8)}...` : 'N/A'}
              </td>
              <td style={tdStyle}>{getTimeAgo(task.queuedAt)}</td>
              <td style={tdStyle}>
                {task.estimatedDuration
                  ? `${task.estimatedDuration}ms`
                  : 'Unknown'}
              </td>
            </tr>
          ))}
          {sortedTasks.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{
                  ...tdStyle,
                  textAlign: 'center',
                  fontStyle: 'italic',
                  opacity: 0.7,
                }}
              >
                No pending tasks
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProcessTable;
