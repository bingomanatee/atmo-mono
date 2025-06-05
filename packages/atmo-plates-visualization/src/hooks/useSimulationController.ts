import { Forest } from '@wonderlandlabs/forestry';
import { useEffect, useState } from 'react';
import {
  SimulationController,
  type SimulationState,
} from '../controllers/SimulationController';

// Global instance
let globalSimulationForest: Forest | null = null;
let globalSimulationController: SimulationController | null = null;

function getGlobalSimulationController(): SimulationController {
  if (!globalSimulationForest) {
    globalSimulationForest = new Forest();
  }

  if (!globalSimulationController) {
    globalSimulationController = new SimulationController(
      globalSimulationForest,
    );
  }

  return globalSimulationController;
}

export const useSimulationController = () => {
  const controller = getGlobalSimulationController();
  const [state, setState] = useState<SimulationState>(controller.value);

  useEffect(() => {
    // Subscribe to state changes
    const subscription = controller.observe((newState) => {
      setState(newState);
    });

    return () => subscription.unsubscribe();
  }, [controller]);

  return [state, controller] as const;
};
