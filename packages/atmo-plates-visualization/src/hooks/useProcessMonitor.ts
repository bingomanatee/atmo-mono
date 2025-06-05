import { useEffect, useState } from 'react';
import { globalStateManager } from '../globalState';
import type { AppState } from '../StateManager';

export const useProcessMonitor = () => {
  const [state, setState] = useState<AppState>({
    processes: {},
    pendingTasks: {},
    totalPlates: 0,
    totalPlatelets: 0,
    activeProcesses: 0,
    pendingTasksCount: 0,
    completedProcesses: 0,
    failedProcesses: 0,
    lastUpdated: Date.now(),
  });

  // Connect to global StateManager
  useEffect(() => {
    // Initial update
    setState(globalStateManager.appState.value);

    // Subscribe to changes
    const subscription = globalStateManager.appState.observe((appState) => {
      setState(appState);
    });

    return () => subscription.unsubscribe();
  }, []);

  return [state, globalStateManager] as const;
};
