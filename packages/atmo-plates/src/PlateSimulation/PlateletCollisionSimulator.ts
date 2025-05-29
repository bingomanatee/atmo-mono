import { Vector3 } from 'three';
import { COLLECTIONS } from './constants';
import { PlateSimulation } from './PlateSimulation';
import { Platelet } from './schemas/platelet';

export class PlateletCollisionSimulator {
  readonly #sim: PlateSimulation;
  readonly #sectorId: string;
  readonly #platelets: Map<string, Platelet>;

  constructor(sim: PlateSimulation, sectorId: string) {
    this.#sim = sim;
    this.#sectorId = sectorId;
    this.#platelets = new Map();

    // Load platelets from the simulation
    const plateletsCollection = sim.simUniv.get(COLLECTIONS.PLATELETS);
    for (const [id, platelet] of plateletsCollection.values()) {
      if (platelet.sector === sectorId) {
        this.#platelets.set(id, platelet);
      }
    }
  }

  get platelets(): Map<string, Platelet> {
    return this.#platelets;
  }

  get sectorId(): string {
    return this.#sectorId;
  }

  findInteractions(): Map<string, Set<string>> {
    const interactions = new Map<string, Set<string>>();
    const plateletIds = Array.from(this.#platelets.keys());

    for (let i = 0; i < plateletIds.length; i++) {
      const id1 = plateletIds[i];
      const platelet1 = this.#platelets.get(id1)!;
      const pos1 = new Vector3().copy(platelet1.position);

      for (let j = i + 1; j < plateletIds.length; j++) {
        const id2 = plateletIds[j];
        const platelet2 = this.#platelets.get(id2)!;
        const pos2 = new Vector3().copy(platelet2.position);

        // Calculate distance between platelets
        const distance = pos1.distanceTo(pos2);
        const interactionDistance = platelet1.radius + platelet2.radius;

        // Check if platelets are interacting
        if (distance <= interactionDistance) {
          // Add interaction to both platelets
          if (!interactions.has(id1)) {
            interactions.set(id1, new Set());
          }
          if (!interactions.has(id2)) {
            interactions.set(id2, new Set());
          }
          interactions.get(id1)!.add(id2);
          interactions.get(id2)!.add(id1);
        }
      }
    }

    return interactions;
  }
}
