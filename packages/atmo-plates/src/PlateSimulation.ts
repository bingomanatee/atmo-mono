import { EARTH_RADIUS, randomNormal } from '@wonderlandlabs/atmo-utils';
import { Multiverse } from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import type { Vector3Like } from 'three';
import { COLLECTIONS, UNIVERSAL_SCHEMA, UNIVERSES } from './constants';
import { PlateSpectrumGenerator } from './generator/PlateSpectrumGenerator';
import type {
  Identifiable,
  PlateIF,
  PlateExtendedIF,
  PlateBehavioralType,
  PLATE_TYPES,
  PlateSimExtendedIF,
  SimSimulation,
} from './types.atmo-plates';
import { simUniverse } from './utils';
import { extendPlate } from './utils/plateUtils';
import { isPlateExtendedIF } from './utils/typeGuards';

// Simulation plate interface with identity and relational links
export interface SimPlateIF extends PlateExtendedIF, Identifiable {
  name?: string; // display name
  planetId: string; // planet reference
  position: Vector3Like; // 3D position
}

// @deprecated Use SimPlateIF instead
export interface Plate extends PlateIF {
  position: Vector3Like; // 3D position
}

interface SimProps {
  id?: string;
  planetId?: string;
  name?: string;
  radius?: number;
}

// Properties for adding a plate to a simulation
type AddPlateProps = (PlateExtendedIF | PlateIF) & {
  id?: string; // unique identifier
  name?: string; // display name
  planetId?: string; // planet reference
};

export class PlateSimulation {
  #mv: Multiverse;

  /**
   * Create a new plate simulation
   * @param planetRadius - Radius of the planet in kilometers
   * @param plateCount - Number of plates to generate (0 for none)
   */
  constructor(
    public planetRadius = EARTH_RADIUS,
    plateCount = 0,
  ) {
    // Initialize the multiverse and universe
    this.#mv = new Multiverse(UNIVERSAL_SCHEMA);
    simUniverse(this.#mv);
    this.addSimulation({ radius: this.planetRadius });

    if (plateCount > 0) {
      const { plates } = this.plateGenerator(plateCount).generate();

      for (const plate of plates) {
        this.addPlate(plate);
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

  /**
   * Add a plate to the simulation
   * @param props - Properties of the plate to add
   * @param simId - Optional simulation ID (uses default if not provided)
   * @returns The ID of the added plate
   */
  addPlate(props: AddPlateProps, simId?: string): string {
    // Check if props is already a PlateExtendedIF
    const isExtendedPlate =
      'behavioralType' in props && 'area' in props && 'mass' in props;

    // Extract properties with defaults
    let { id, name, radius, density = 1, thickness = 1, planetId } = props;

    // Generate ID if not provided
    if (!id) id = uuidV4();

    // Use default simulation if not specified
    if (!simId) simId = this.#defaultSimId;

    // Generate name if not provided
    if (!name) name = `plate-${id}`;

    // If planetId is not provided, get it from the simulation
    if (!planetId) {
      if (!simId) {
        throw new Error('must define or have created a simulation');
      }

      // Get planetId from the simulation
      planetId = this.#simulation(simId)?.planetId;
      if (!planetId) {
        throw new Error('no planetId found in simulation');
      }
    }

    // Verify the planet exists
    const planet = this.simUniv.get(COLLECTIONS.PLANETS).get(planetId);
    if (!planet) {
      throw new Error(`Planet ${planetId} not found`);
    }

    // Create position vector on the planet surface
    const position = randomNormal().setLength(planet.radius);

    // Create the plate object with SimPlateIF interface
    let plateData: SimPlateIF;

    if (isExtendedPlate) {
      // If it's already an extended plate, just add the simulation-specific properties
      plateData = {
        ...(props as PlateExtendedIF),
        id,
        name,
        planetId,
        position,
      };
    } else {
      // If it's a basic plate, extend it with derived properties
      const basicPlate: PlateIF & { id: string } = {
        id,
        radius,
        density,
        thickness,
      };

      // Extend the plate with derived properties
      const extendedPlate = extendPlate(basicPlate, planet.radius);

      // Add simulation-specific properties
      plateData = {
        id, // Explicitly add id to ensure TypeScript recognizes it
        ...extendedPlate,
        name,
        planetId,
        position,
      };
    }

    // Add the plate to the collection
    this.simUniv.get(COLLECTIONS.PLATES).set(id, plateData);

    // Initialize plate steps (currently empty implementation)
    this.#initPlateSteps(id);

    return id;
  }

  #initPlateSteps(plateId: string) {}

  #planet: { id: string; radius: number } | undefined;
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
