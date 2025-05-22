import { COLLECTIONS } from '../../schema';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import { v4 as uuidV4 } from 'uuid';
import { randomNormal, varyP } from '@wonderlandlabs/atmo-utils';
import { Vector3, Object3D } from 'three';
import { asCoord, varySpeedByRadius } from '../../utils';
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { deGenerateMaps } from '@wonderlandlabs/multiverse';
import { createOrbitalFrame } from '../utils/plateMovement';

export type PSPMProps = {
  sim: PlateSimulationIF;
  id?: string;
  plate?: SimPlateIF;
};

export default class PlateSimulationPlateManager {
  #sim: PlateSimulationIF;
  #plate?: SimPlateIF;

  /**
   * Get the steps collection from the simulation universe
   */
  get stepsCollection() {
    const collection = this.#sim.simUniv.get(COLLECTIONS.STEPS);
    if (!collection) throw new Error('steps collection not found');
    return collection;
  }

  constructor(props: PSPMProps) {
    let { sim, id, plate } = props;
    this.#sim = sim;
    if (!plate && id) plate = sim.getPlate(id);

    if (plate) this.initPlate(plate);
  }

  initPlate(plate: SimPlateIF) {
    this.#plate = plate;
    this.#initPlateSteps();
  }

  #initPlateSteps() {
    if (!this.#sim.simulation) throw new Error('simulation required');
    if (!this.#plate) throw new Error('plate required');

    const steps = this.stepsCollection.find('plateId', this.#plate.id);
    if (!steps?.length) {
      this.#addFirstStep();
    } else {
      console.log('#initPlateSteps: steps already exist');
    }
  }

  #addFirstStep() {
    if (!this.#plate) throw new Error('plate required');

    const planet = this.#sim.getPlanet(this.#plate.planetId);
    if (!planet) throw new Error(`Planet ${this.#plate.planetId} not found`);

    const stepId = uuidV4();

    const position = this.#plate.position
      ? new Vector3(
          this.#plate.position.x,
          this.#plate.position.y,
          this.#plate.position.z,
        )
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
      plateId: this.#plate.id,
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
   * Get the current step for the plate
   */
  #getCurrentStep() {
    if (!this.#plate) throw new Error('plate required');

    const stepsGen = this.stepsCollection.find('plateId', this.#plate.id);
    const stepsMap = deGenerateMaps(stepsGen);
    if (!stepsMap.size) throw new Error('no steps found for plate');

    return [...stepsMap.values()].reduce((latest, step) => {
      return step.step > latest.step ? step : latest;
    });
  }

  /**
   * Move the plate to its next position based on its current velocity and speed
   * Uses ThreeOrbitalFrame to calculate the next position
   */
  movePlate() {
    if (!this.#plate) throw new Error('plate required');
    if (!this.#sim.simulation) throw new Error('simulation required');

    // Get the current step
    const currentStep = this.#getCurrentStep();

    // Get the planet for radius
    const planet = this.#sim.getPlanet(this.#plate.planetId);
    if (!planet) throw new Error(`Planet ${this.#plate.planetId} not found`);

    // Create and configure the orbital frame at origin
    const orbitalFrame = createOrbitalFrame(currentStep, planet);

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
      position: newPosition,
      velocity: orbitalFrame.axis.clone().multiplyScalar(currentStep.speed),
    };

    this.stepsCollection.set(currentStep.id, newStep);

    return newStep;
  }
}
