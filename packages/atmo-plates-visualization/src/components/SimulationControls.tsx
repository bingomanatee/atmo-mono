import React, { useState } from 'react';
import { useSimulationController } from '../hooks/useSimulationController';
import { STATUS_TYPES } from '../constants/statusTypes';

const SimulationControls: React.FC = () => {
  const [simulationState, simulationController] = useSimulationController();

  const {
    status,
    plateCount,
    maxPlateRadius,
    planetRadius,
    useWorkers,
    useSharedStorage,
    progress,
    error,
    generatedPlates,
    generatedPlatelets,
  } = simulationState;

  // Computed values from controller
  const isRunning = simulationController.acts.isRunning();
  const isCompleted = simulationController.acts.isCompleted();
  const isFailed = simulationController.acts.isFailed();
  const executionTime = simulationController.acts.getExecutionTime();
  const progressPercentage = simulationController.acts.getProgressPercentage();

  const [configValues, setConfigValues] = useState({
    plateCount,
    maxPlateRadius,
    planetRadius,
    useWorkers,
    useSharedStorage,
  });

  const handleConfigChange = (key: string, value: any) => {
    const newConfig = { ...configValues, [key]: value };
    setConfigValues(newConfig);

    if (!isRunning) {
      simulationController.acts.updateConfig(newConfig);
    }
  };

  const handleStart = () => {
    try {
      // Just start the simulation - useEffect will handle the phase transitions
      simulationController.acts.startSimulation(configValues);
    } catch (err) {
      console.error('Failed to start simulation:', err);
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    background: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid #333',
    borderRadius: '8px',
    color: 'white',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    maxWidth: '400px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #444',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    margin: '5px 0',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid #555',
    borderRadius: '4px',
    color: 'white',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 15px',
    margin: '5px',
    background: 'rgba(33, 150, 243, 0.8)',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'rgba(100, 100, 100, 0.5)',
    cursor: 'not-allowed',
  };

  const progressBarStyle: React.CSSProperties = {
    width: '100%',
    height: '20px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    margin: '10px 0',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    background: isCompleted ? '#4CAF50' : isFailed ? '#F44336' : '#2196F3',
    width: `${progressPercentage}%`,
    transition: 'width 0.3s ease',
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 20px 0', color: '#4CAF50' }}>
        Simulation Controls
      </h3>

      {/* Status Section */}
      <div style={sectionStyle}>
        <h4 style={{ margin: '0 0 10px 0' }}>Status</h4>
        <div>
          <strong>Status:</strong> {status}
        </div>
        <div>
          <strong>Progress:</strong> {progressPercentage}%
        </div>
        <div style={progressBarStyle}>
          <div style={progressFillStyle}></div>
        </div>
        {executionTime > 0 && (
          <div>
            <strong>Execution Time:</strong> {Math.round(executionTime / 1000)}s
          </div>
        )}
        {error && (
          <div style={{ color: '#F44336', marginTop: '10px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Configuration Section */}
      <div style={sectionStyle}>
        <h4 style={{ margin: '0 0 10px 0' }}>Configuration</h4>

        <label>
          Plate Count:
          <input
            type="number"
            value={configValues.plateCount}
            onChange={(e) =>
              handleConfigChange('plateCount', parseInt(e.target.value))
            }
            disabled={isRunning}
            style={inputStyle}
            min="1"
            max="200"
          />
        </label>

        <label>
          Max Plate Radius (km):
          <input
            type="number"
            value={configValues.maxPlateRadius}
            onChange={(e) =>
              handleConfigChange('maxPlateRadius', parseFloat(e.target.value))
            }
            disabled={isRunning}
            style={inputStyle}
            min="100"
            max="2000"
          />
        </label>

        <label>
          Planet Radius (km):
          <input
            type="number"
            value={configValues.planetRadius}
            onChange={(e) =>
              handleConfigChange('planetRadius', parseFloat(e.target.value))
            }
            disabled={isRunning}
            style={inputStyle}
            min="1000"
            max="10000"
          />
        </label>

        <label
          style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}
        >
          <input
            type="checkbox"
            checked={configValues.useWorkers}
            onChange={(e) => handleConfigChange('useWorkers', e.target.checked)}
            disabled={isRunning}
            style={{ marginRight: '10px' }}
          />
          Use Workers
        </label>

        <label
          style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}
        >
          <input
            type="checkbox"
            checked={configValues.useSharedStorage}
            onChange={(e) =>
              handleConfigChange('useSharedStorage', e.target.checked)
            }
            disabled={isRunning}
            style={{ marginRight: '10px' }}
          />
          Use Shared Storage
        </label>
      </div>

      {/* Control Buttons */}
      <div style={sectionStyle}>
        <h4 style={{ margin: '0 0 10px 0' }}>Controls</h4>

        <button
          onClick={handleStart}
          disabled={isRunning}
          style={isRunning ? disabledButtonStyle : buttonStyle}
        >
          Start Simulation
        </button>

        <button
          onClick={() => simulationController.acts.stopSimulation()}
          disabled={!isRunning}
          style={!isRunning ? disabledButtonStyle : buttonStyle}
        >
          Stop
        </button>

        <button
          onClick={
            status === STATUS_TYPES.SIMULATION.PAUSED
              ? () => simulationController.acts.resumeSimulation()
              : () => simulationController.acts.pauseSimulation()
          }
          disabled={!isRunning && status !== STATUS_TYPES.SIMULATION.PAUSED}
          style={
            !isRunning && status !== STATUS_TYPES.SIMULATION.PAUSED
              ? disabledButtonStyle
              : buttonStyle
          }
        >
          {status === STATUS_TYPES.SIMULATION.PAUSED ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={() => simulationController.acts.resetSimulation()}
          disabled={isRunning}
          style={isRunning ? disabledButtonStyle : buttonStyle}
        >
          Reset
        </button>
      </div>

      {/* Results Section */}
      {(generatedPlates > 0 || generatedPlatelets > 0) && (
        <div>
          <h4 style={{ margin: '0 0 10px 0' }}>Results</h4>
          <div>
            <strong>Generated Plates:</strong> {generatedPlates}
          </div>
          <div>
            <strong>Generated Platelets:</strong>{' '}
            {generatedPlatelets.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationControls;
