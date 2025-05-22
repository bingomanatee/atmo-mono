import { randomNormal, varyP } from '@wonderlandlabs/atmo-utils';
import { Object3D, Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { COLLECTIONS } from '../../schema';
import { varySpeedByRadius } from '../../utils';
import type {
  PlateSimulationIF,
  SimPlateIF,
  SimStepIF,
} from '../types.PlateSimulation';
import { createOrbitalFrame } from '../utils/plateMovement';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';

export type PSPMProps = {
  sim: PlateSimulationIF;
};

export default class PlateSimulationPlateManager {
  #sim: PlateSimulationIF;

  /**
   * Get the steps collection from the simulation universe
   */
  get stepsCollection() {
    const collection = this.#sim.simUniv.get(COLLECTIONS.STEPS);
    if (!collection) throw new Error('steps collection not found');
    return collection;
  }

  constructor(sim: PlateSimulationIF) {
    this.#sim = sim;
  }

  // Method to initialize steps for a specific plate
  initPlateSteps(plateId: string) {
    const steps = this.stepsCollection.find('plateId', plateId);
    if (!steps?.length) {
      this.#addFirstStep(plateId);
    } else {
      console.log(`initPlateSteps: steps already exist for plate ${plateId}`);
    }
  }

  // Method to add the first step for a specific plate
  #addFirstStep(plateId: string) {
    // @ts-ignore
    const plate: SimPlateIF = this.#sim.getPlate(plateId);
    if (!plate) throw new Error('plate now found');
    const planet = this.#sim.getPlanet(plate.planetId);
    if (!planet) throw new Error(`Planet ${plate.planetId} not found`);

    const stepId = uuidV4();

    const position = plate.position
      ? new Vector3(plate.position.x, plate.position.y, plate.position.z)
      : randomNormal().multiplyScalar(planet.radius);

    const speed = varyP({ min: 5, max: 250 });
    const scaledSpeed = varySpeedByRadius(speed, planet.radius);
    let startingVelocity;

    do {
      startingVelocity = randomNormal();
      startingVelocity.z = 0;
    } while (!startingVelocity.length());
    startingVelocity.setLength(scaledSpeed);

    const stepData = {
      id: stepId,
      plateId: plate.id,
      step: 0,
      speed, // Use provided speed or random between 5-250
      position,
      velocity: startingVelocity,
      start: position,
    };

    this.stepsCollection.set(stepId, stepData);

    return stepId;
  }

  /**
   * Get the current step for a specific plate
   */
  #getCurrentStep(plateId: string): SimStepIF {
    const stepsGen = this.stepsCollection.find('plateId', plateId) as Iterable<
      [string, SimStepIF]
    >;
    const stepsMap = new Map<string, SimStepIF>(stepsGen);
    if (!stepsMap.size) throw new Error('no steps found for plate');

    return [...stepsMap.values()].reduce((latest, step) => {
      return step.step > latest.step ? step : latest;
    });
  }

  /**
   * Move a specific plate to its next position
   * Uses ThreeOrbitalFrame to calculate the next position
   */
  movePlate(plateId: string) {
    if (!this.#sim.simulation) throw new Error('simulation required');

    // Get the current step
    const currentStep = this.#getCurrentStep(plateId);

    // Get the planet for radius
    const plate = this.#sim.getPlate(plateId);
    if (!plate) throw new Error(`Plate ${plateId} not found in simulation`);

    const planet = this.#sim.getPlanet(plate.planetId);
    if (!planet) throw new Error(`Planet ${plate.planetId} not found`);

    // Create and configure the orbital frame at origin
    const orbitalFrame = createOrbitalFrame(
      {
        speed: currentStep.speed,
        velocity: new Vector3(
          currentStep.velocity.x,
          currentStep.velocity.y,
          currentStep.velocity.z,
        ),
      },
      planet,
    );

    // Create a proxy object in the frame at (0, 0, radius) in local space
    const plateProxy = new Object3D();
    plateProxy.position.set(0, 0, planet.radius);
    orbitalFrame.add(plateProxy);

    // Move the orbital frame
    orbitalFrame.orbit();

    // Get the new global position of the proxy object
    const newPosition = plateProxy.position.clone();
    orbitalFrame.localToWorld(newPosition);

    // Update the step with new position and velocity
    const newStep = {
      ...currentStep,
      step: currentStep.step + 1,
      position: new Vector3(newPosition.x, newPosition.y, newPosition.z),
      velocity: new Vector3(
        orbitalFrame.axis.x,
        orbitalFrame.axis.y,
        orbitalFrame.axis.z,
      ).multiplyScalar(currentStep.speed),
    };

    this.stepsCollection.set(currentStep.id, newStep as SimStepIF);

    return newStep;
  }
}
