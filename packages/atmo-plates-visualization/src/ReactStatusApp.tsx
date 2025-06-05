import React from 'react';
import { createRoot } from 'react-dom/client';
import StatusTable from './StatusTable';

interface ReactStatusAppProps {
  containerId?: string;
}

const ReactStatusApp: React.FC<ReactStatusAppProps> = ({ containerId = 'react-status-root' }) => {
  return (
    <div id={containerId}>
      <StatusTable />
    </div>
  );
};

/**
 * Initialize the React status table in the DOM
 * This function can be called from existing TypeScript code
 */
export const initializeReactStatusTable = (containerId: string = 'react-status-root') => {
  // Create container if it doesn't exist
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '1000';
    document.body.appendChild(container);
  }

  // Create React root and render the app
  const root = createRoot(container);
  root.render(<ReactStatusApp containerId={containerId} />);

  return root;
};

/**
 * Alternative initialization that replaces existing status elements
 */
export const replaceStatusElementsWithReactTable = () => {
  // Hide existing status elements
  const existingElements = [
    'storage-info',
    'worker-info', 
    'performance-info',
    'viz-title'
  ];

  existingElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = 'none';
    }
  });

  // Initialize React table
  return initializeReactStatusTable('react-status-replacement');
};

export default ReactStatusApp;
