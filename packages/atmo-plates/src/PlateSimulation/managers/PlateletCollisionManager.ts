import { Vector3 } from 'three';
import { COLLECTIONS } from '../constants';
import type {
  PlateletStepIF,
  PlateSimulationIF,
} from '../types.PlateSimulation';

export class PlateletCollisionManager {
  readonly #sim: PlateSimulationIF;
  readonly #EPSILON = 5; // More practical epsilon for geological-scale objects

  constructor(sim: PlateSimulationIF) {
    this.#sim = sim;
  }

  /**
   * Find interactions between platelets in a given sector at a specific step
   * @param sectorId The sector to check for collisions
   * @param step The simulation step to check
   * @returns Map of platelet IDs to their interacting platelet IDs
   */
  findInteractions(sectorId: string, step: number): Map<string, Set<string>> {
    const interactions = new Map<string, Set<string>>();
    const plateletStepsCollection = this.#sim.simUniv.get(
      COLLECTIONS.PLATELET_STEPS,
    );
    if (!plateletStepsCollection)
      throw new Error('platelet steps collection not found');

    // Find platelet steps in this sector at this step
    const sectorPlateletSteps = Array.from(
      plateletStepsCollection.find('sector', sectorId, 'step', step),
    ) as PlateletStepIF[];

    // Reality check: Skip if there are fewer than two different plate IDs
    const uniquePlateIds = new Set(
      sectorPlateletSteps.map((step) => step.plateId),
    );
    if (uniquePlateIds.size < 2) {
      console.log(
        'Sector has fewer than two different plate IDs. Skipping interaction check.',
      );
      return interactions;
    }

    // Continue with the interaction logic
    for (let i = 0; i < sectorPlateletSteps.length; i++) {
      const step1 = sectorPlateletSteps[i];
      const pos1 = new Vector3().copy(step1.position);

      for (let j = i + 1; j < sectorPlateletSteps.length; j++) {
        const step2 = sectorPlateletSteps[j];
        const pos2 = new Vector3().copy(step2.position);

        // Calculate distances and thresholds
        const distance = pos1.distanceTo(pos2);
        const interactionDistance = step1.thickness + step2.thickness;
        const shouldInteract = distance <= interactionDistance + this.#EPSILON;

        if (shouldInteract) {
          if (!interactions.has(step1.id)) {
            interactions.set(step1.id, new Set());
          }
          interactions.get(step1.id)!.add(step2.id);
        }
      }
    }

    return interactions;
  }
}
