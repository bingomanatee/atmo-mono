import { EARTH_RADIUS, randomNormal } from '@wonderlandlabs/atmo-utils';
import { Multiverse } from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import { COLLECTIONS, UNIVERSAL_SCHEMA, UNIVERSES } from './constants';
import { PlateSpectrumGenerator } from './generator/PlateSpectrumGenerator';
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
};

export class PlateSimulation {
  #mv: Multiverse;

  constructor(
    private planetRadius = EARTH_RADIUS,
    plateCount = 0,
  ) {
    this.#mv = new Multiverse(UNIVERSAL_SCHEMA);
    simUniverse(this.#mv);

    // Create a default simulation with the planet
    if (plateCount > 0) {
      // Create a simulation with the specified planet radius
      this.addSimulation({ radius: this.planetRadius });

      // Generate plates using the plateGenerator
      const { plates } = this.plateGenerator(plateCount).generate();

      // Add each plate to the simulation
      for (const plate of plates) {
        this.addPlate({
          radius: plate.radius,
          density: plate.density,
          thickness: plate.thickness,
        });
      }
    }
  }

  plateGenerator(plateCount: number) {
    return new PlateSpectrumGenerator({
      planetRadius: this.planetRadius,
      plateCount: plateCount,
    });
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

  addPlate(props: AddPlateProps, simId?: string) {
    let { id, name, radius, density = 1, thickness = 1, planetId } = props;
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
    this.#initPlateSteps(id);
  }

  #initPlateSteps(plateId: string) {}

  #planet;
  get planet() {
    if (!this.#planet) {
      this.#planet = this.makePlanet();
    }
    return this.#planet;
  }

  makePlanet(radius = this.planetRadius) {
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
