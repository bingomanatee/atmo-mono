import React from 'react';
import ProcessMonitorApp from './components/ProcessMonitorApp';
import SimulationControls from './components/SimulationControls';

const App: React.FC = () => {
  const appStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    zIndex: 10000,
  };

  return (
    <div className="atmo-plates-app" style={appStyle}>
      <SimulationControls />
      <ProcessMonitorApp showControls={true} showStatusInfo={true} />
    </div>
  );
};

export default App;
