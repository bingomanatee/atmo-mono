import { randomNormal } from '@wonderlandlabs/atmo-utils';
import { Multiverse, Universe } from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import { COLLECTIONS, UNIVERSAL_SCHEMA, UNIVERSES } from './constants';
import type { SimSimulation } from './types.atmo-plates';
import { simUniverse } from './utils';

export interface Plate {
  x: number;
  y: number;
  z: number;
  radius: number;
  density: number;
  thickness: number;
}

interface SimProps {
  id?: string;
  planetId?: string;
  name?: string;
  radius?: number;
}

type AddPlateProps = {
  id?: string;
  name?: string;
  radius: number;
  density?: number;
  thickness?: number;
  planetId?: string;
  simId?: string;
};

export class PlateSimulation {
  #mv: Multiverse;

  constructor() {
    this.#mv = new Multiverse(UNIVERSAL_SCHEMA);
    simUniverse(this.#mv);
  }

  /**
   * Add a universe to the multiverse
   * @param universe The universe to add
   */
  addUniverse(universe: Universe): void {
    this.#mv.add(universe);
  }

  get simUniv() {
    return this.#mv.get(UNIVERSES.SIM)!;
  }

  #defaultSimId: string | undefined;

  addSimulation(props: SimProps): string {
    let { name, id, radius, planetId } = props;

    if (!id) id = uuidV4();
    if (!name) name = `sim-${id}`;
    if (planetId) {
      const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
      if (!planet) {
        throw new Error(`Planet ${planetId} not found`);
      }

      this.simUniv.get(COLLECTIONS.SIMULATIONS).set(id, {
        id,
        name,
        planetId,
      });
      if (!this.#defaultSimId) {
        this.#defaultSimId = id;
      }
      return id;
    } else if (radius) {
      const planet = this.makePlanet(radius);
      return this.addSimulation({ name, id, planetId: planet.id });
    } else {
      throw new Error(
        'addSimulation: Either planetId or radius must be provided',
      );
    }
  }

  #simulation(simId?: string): SimSimulation {
    if (!simId && this.#defaultSimId) {
      return this.#simulation(this.#defaultSimId);
    }
    if (!simId) {
      throw new Error('no simulation id present and no default set');
    }
    return this.simUniv.get(COLLECTIONS.SIMULATIONS).get(simId);
  }

  addPlate(props: AddPlateProps) {
    let {
      id,
      name,
      radius,
      density = 1,
      thickness = 1,
      planetId,
      simId,
    } = props;
    if (!id) id = uuidV4();
    if (!simId) simId = this.#defaultSimId;
    if (!name) name = `plate-${id}`;
    if (!planetId) {
      if (!simId) {
        throw new Error('must define or have created a simulation');
      }
      planetId = this.#simulation(simId)?.planetId;
      if (!planetId) {
        throw new Error('no planetId found in simulation');
      }
      const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);

      if (!planet) {
        throw new Error(`Planet ${planetId} not found`);
      }

      const position = randomNormal().setLength(planet.radius);
      this.simUniv.get(COLLECTIONS.PLATES).set(id, {
        id,
        name,
        radius,
        density,
        thickness,
        planetId,
        position,
      });
      return id;
    } else {
      const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
      const position = randomNormal().setLength(planet.radius);
      this.simUniv.get(COLLECTIONS.PLATES).set(id, {
        id,
        name,
        radius,
        density,
        thickness,
        planetId,
        position,
      });
    }
  }

  makePlanet(radius: number) {
    if (radius < 1000) {
      throw new Error('planet radii mus be >= 1000km');
    }
    const planetId = uuidV4();
    const planetData = {
      id: planetId,
      radius,
    };

    // Set the planet data in the collection
    this.simUniv.get(COLLECTIONS.PLANETS).set(planetId, planetData);

    // Get the planet data back to verify it was set
    const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);

    if (!planet) {
      throw new Error(`Planet ${planetId} not found`);
    }

    return planet;
  }
}
