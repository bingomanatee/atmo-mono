import { COLLECTIONS } from '../../schema';
import type { PlateSimulationIF, SimPlateIF } from '../types.PlateSimulation';
import { v4 as uuidV4 } from 'uuid';
import { randomNormal, varyP } from '@wonderlandlabs/atmo-utils';
import { Vector3 } from 'three';
import { asCoord, varySpeedByRadius } from '../../utils';

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
}
