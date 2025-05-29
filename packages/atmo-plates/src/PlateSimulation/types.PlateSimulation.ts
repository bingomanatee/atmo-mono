import type { Vector3Like } from 'three';
import type { Universe, Multiverse } from '@wonderlandlabs/multiverse';
import type {
  PlateIF as PlateIFBase,
  PlateExtendedIF,
  Identifiable,
  SimPlanetIF,
  SimSimulation,
} from '../types.atmo-plates';
import type { PlateSpectrumGenerator } from '../generator/PlateSpectrumGenerator';
import { Planet } from './Planet';

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
  maxPlateRadius?: number;
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
  maxPlateRadius?: number;
}

export interface PlateSimulationIF {
  // Properties
  planetRadius: number;
  universeName: string;
  simulationId?: string;
  readonly managers: Map<string, any>;

  // Multiverse and Universe access
  readonly multiverse: Multiverse;
  readonly simUniv: Universe;

  // Initialization
  init(): void;

  // Plate management
  plateGenerator(plateCount: number): PlateSpectrumGenerator;
  addPlate(props: AddPlateProps, simId?: string): string;
  getPlate(id: string): SimPlateIF;

  // Simulation management
  addSimulation(props: SimProps): string;
  getSimulationById(simId: string): SimSimulation;
  readonly simulation: SimSimulation;

  // Planet management
  planet?: Planet;
  makePlanet(radius?: number, name?: string): Planet;
  getPlanet(id: string): Planet;
}

// Simulation step interface
export interface SimStepIF {
  id: string;
  plateId: string;
  step: number;
  speed: number; // Speed in meters per step
  position: Vector3Like;
  velocity: Vector3Like;
  start: Vector3Like; // Starting position of the step
}

// Interface for the stateless PlateSimulationPlateManager
export interface PlateSimulationPlateManagerIF {
  new (sim: PlateSimulationIF): PlateSimulationPlateManagerIF;
  initPlateSteps(plate: SimPlateIF): void;
  movePlate(plateId: string): SimStepIF;
}

// Interface for Platelet Steps
export interface PlateletStepIF extends Identifiable {
  plateId: string; // ID of the plate this platelet belongs to
  plateletId: string; // ID of the platelet itself
  step: number; // Step number in the simulation
  position: Vector3Like;
  thickness: number;
  float: number; // Floating elevation
  h3Index: string; // H3 index of current location
  sector: string; // L0 H3 cell for tracking large-scale movement
}

// Local PlateIF interface for PlateSimulation module
export interface PlateIF extends PlateIFBase {
  id: string;
  elevation?: number; // Optional elevation in meters
  area?: number;
  position?: Vector3Like;
  velocity?: Vector3Like;
  isActive?: boolean;
  name?: string;
  planetId?: string;
}

// Interface for Platelet in PlateSimulation context
export interface PlateletIF {
  id: string;
  plateId: string;
  planetId: string;
  position: Vector3Like;
  radius: number;
  thickness: number;
  density: number;
  sector: string;
  h3Index?: string;
  float?: number;
}

// Raw platelet data interface
export interface RawPlatelet {
  id?: string;
  plateId?: string;
  planetId?: string;
  position?: Vector3Like;
  radius?: number;
  thickness?: number;
  density?: number;
  sector?: string;
  h3Index?: string;
  float?: number;
}

// Re-export types that are used in imports
export type { PlateExtendedIF, Identifiable, SimPlanetIF };
