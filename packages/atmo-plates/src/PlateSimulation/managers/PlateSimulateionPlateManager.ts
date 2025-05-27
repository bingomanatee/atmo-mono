import { Vector3 } from 'three';
import type { PlateletIF } from '../types.PlateSimulation';
import type { SimStepIF } from '../types.PlateSimulation';
import type { PlateletStepIF } from '../types.PlateSimulation';
import type { PlateSimulationIF } from '../types.PlateSimulation';
import { COLLECTIONS } from '../constants';
import type { Platelet } from '../schemas/platelet';

export class PlateSimulationPlateManager {
  private sim: PlateSimulationIF;

  constructor(sim: PlateSimulationIF) {
    this.sim = sim;
  }

  addFirstStep(platelet: PlateletIF): void {
    const plateletSteps = this.sim.simUniv.get(COLLECTIONS.PLATELET_STEPS);
    const currentStep = this.sim.simulation.step;

    // Initialize first step with current position and zero velocity
    const step: PlateletStepIF = {
      id: `${platelet.id}_${currentStep}`,
      plateId: platelet.plateId,
      plateletId: platelet.id,
      step: currentStep,
      position: new Vector3().copy(platelet.position), // Copy position to avoid modifying original platelet object
      thickness: platelet.thickness,
      float: platelet.float,
      h3Index: platelet.h3Index,
    };
    // Ensure the collection is available before adding
    if (plateletSteps) {
      plateletSteps.add(step);
    }

    // Update platelet with initial values (these should probably be handled elsewhere or carefully considered)
    // For now, just setting initial last values
    platelet.lastPosition = new Vector3().copy(platelet.position);
    platelet.lastStep = currentStep;
    platelet.lastH3Index = platelet.h3Index;
    platelet.lastFloat = platelet.float;
    platelet.lastThickness = platelet.thickness;
  }

  initPlateSteps(plateId: string): void {
    const plate = this.sim.getPlate(plateId);
    const platelets = this.sim.simUniv.get(COLLECTIONS.PLATELETS);

    if (!plate || !platelets) {
      console.warn(
        `Could not initialize plate steps for plate ${plateId}: plate or platelet collection not found.`,
      );
      return;
    }

    const platePlatelets = platelets.find({ plateId });

    // Initialize steps for each platelet
    platePlatelets.forEach((platelet: PlateletIF) => {
      this.addFirstStep(platelet);
    });
  }

  movePlate(plateId: string): SimStepIF {
    const plate = this.sim.getPlate(plateId);
    const platelets = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
    const plateletSteps = this.sim.simUniv.get(COLLECTIONS.PLATELET_STEPS);
    const currentStep = this.sim.simulation.step;

    if (!plate || !platelets || !plateletSteps) {
      throw new Error(
        `Could not move plate ${plateId}: plate, platelet collection, or platelet step collection not found.`,
      );
    }

    // Get all platelets for this plate
    const platePlatelets = platelets.find({ plateId });

    // Move each platelet
    platePlatelets.forEach((platelet: PlateletIF) => {
      // Calculate movement (Assuming calculatePlateletMovement exists and is accessible/imported)
      // This method doesn't seem to be defined in this file, will need to be added or imported if it exists elsewhere.
      // For now, adding a placeholder/assumption.
      const movement = new Vector3(0, 0, 0); // Placeholder
      // const movement = this.calculatePlateletMovement(platelet, plate);

      // Update platelet position and properties
      platelet.position.add(movement);
      platelet.float += movement.y;
      platelet.thickness = Math.max(0, platelet.thickness + movement.y);

      // Update H3 index if position changed significantly (Assuming updateH3Index exists)
      // const newH3Index = this.updateH3Index(platelet);
      const newH3Index = platelet.h3Index; // Placeholder

      // Create step record
      const step: PlateletStepIF = {
        id: `${platelet.id}_${currentStep}`,
        plateId,
        plateletId: platelet.id,
        step: currentStep,
        position: new Vector3().copy(platelet.position), // Copy position
        thickness: platelet.thickness,
        float: platelet.float,
        h3Index: newH3Index,
      };
      plateletSteps.add(step);

      // Update last values
      platelet.lastPosition = new Vector3().copy(platelet.position);
      platelet.lastStep = currentStep;
      platelet.lastH3Index = newH3Index;
      platelet.lastFloat = platelet.float;
      platelet.lastThickness = platelet.thickness;
    });

    // Return plate movement step
    const plateStep: SimStepIF = {
      id: `${plateId}_${currentStep}`,
      plateId,
      step: currentStep,
      speed: 0, // TODO: Calculate actual speed
      position: new Vector3().copy(plate.position), // Copy position
      velocity: new Vector3(0, 0, 0), // TODO: Calculate actual velocity
      start: new Vector3().copy(plate.position), // Copy position
    };
    // The return type is SimStepIF, so we return the plate step.
    return plateStep;
  }
}
