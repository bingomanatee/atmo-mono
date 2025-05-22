import type { Vector3Like } from 'three';
import type { Universe, Multiverse } from '@wonderlandlabs/multiverse';
import type {
  PlateIF,
  PlateExtendedIF,
  SimSimulation,
  Identifiable,
  SimPlanetIF,
} from '../types.atmo-plates';
import type { PlateSpectrumGenerator } from '../generator/PlateSpectrumGenerator';

// Simulation plate interface with identity and relational links
export interface SimPlateIF extends PlateExtendedIF, Identifiable {
  name?: string;
  planetId: string;
  position: Vector3Like;
}

export interface SimProps {
  id?: string;
  planetId?: string;
  name?: string;
  radius?: number;
  plateCount?: number;
}

export type AddPlateProps = (PlateExtendedIF | PlateIF) & {
  id?: string;
  name?: string;
  planetId?: string;
};

export interface PlateSimulationProps {
  planetRadius?: number;
  plateCount?: number;
  multiverse?: Multiverse;
  universeName?: string;
  simulationId?: string;
}

export interface PlateSimulationIF {
  // Properties
  planetRadius: number;
  universeName: string;
  simulationId?: string;

  // Multiverse and Universe access
  readonly multiverse: Multiverse;
  readonly simUniv: Universe;

  // Initialization
  init(): void;

  // Plate management
  plateGenerator(plateCount: number): PlateSpectrumGenerator;
  addPlate(props: AddPlateProps, simId?: string): string;
  getPlate(id: string): SimPlateIF | undefined;

  // Simulation management
  addSimulation(props: SimProps): string;
  getSimulationById(simId: string): SimSimulation;
  readonly simulation: SimSimulation;

  // Planet management
  planet?: SimPlanetIF;
  makePlanet(radius?: number, name?: string): SimPlanetIF;
  getPlanet(id: string): SimPlanetIF | undefined;
}
