import { Universe } from '@wonderlandlabs/multiverse';
import { latLngToCell, randomNormal, varyP } from '@wonderlandlabs/atmo-utils';
import { Object3D, Vector3 } from 'three';
import { v4 as uuidV4 } from 'uuid';
import { COLLECTIONS } from '../constants';
import { varySpeedByRadius } from '../../utilities';
import { ContextProvider, MANAGER_TYPES } from '../interfaces/ContextProvider';
import type { Platelet } from '../schemas/platelet';
import type {
  PlateletStepIF,
  SimPlateIF,
  SimStepIF,
} from '../types.PlateSimulation';
import { createOrbitalFrame, movePlate } from '../utils/plateMovement';
import { PlateletManager } from './PlateletManager';

export default class PlateSimulationPlateManager {
  #universe: Universe;

  /**
   * Get the steps collection from the universe
   */
  get stepsCollection() {
    const collection = this.#universe.get(COLLECTIONS.STEPS);
    if (!collection) throw new Error('steps collection not found');
    return collection;
  }

  constructor(universe: Universe) {
    this.#universe = universe;
  }

  // Method to initialize steps for a specific plate
  async initPlateSteps(plateId: string, context: ContextProvider) {
    const steps = this.stepsCollection.find('plateId', plateId);
    if (!steps?.length) {
      await this.#addFirstStep(plateId);

      // Get PlateletManager from context and generate platelets
      const plateletManager = context.getManager<PlateletManager>(
        MANAGER_TYPES.PLATELET,
      );
      const platelets = await plateletManager.generatePlatelets(plateId);
      const plateletStepsCollection = this.#universe.get(
        COLLECTIONS.PLATELET_STEPS,
      );

      if (!plateletStepsCollection)
        throw new Error('platelet_steps collection not found');

      platelets.forEach((platelet) => {
        if (!platelet.id) {
          console.warn('Platelet missing id:', platelet);
          return;
        }
        const plateletStep: PlateletStepIF = {
          id: uuidV4(),
          plateletId: platelet.id,
          plateId: platelet.plateId,
          step: 0,
          position: platelet.position,
          thickness: platelet.thickness,
          float: platelet.elevation || 0,
          h3Index: latLngToCell(platelet.position.y, platelet.position.x, 4),
          sector: latLngToCell(platelet.position.y, platelet.position.x, 0), // L0 cell for sector tracking
        };
        plateletStepsCollection.set(plateletStep.id, plateletStep);
      });
    } else {
      console.log(`initPlateSteps: steps already exist for plate ${plateId}`);
    }
  }

  #initVelocity(radius: number) {
    const speed = varyP({ min: 5, max: 250 });
    const scaledSpeed = varySpeedByRadius(speed, radius);
    let startingVelocity;

    do {
      startingVelocity = randomNormal();
      startingVelocity.z = 0;
    } while (!startingVelocity.length());
    startingVelocity.setLength(scaledSpeed);

    return { speed, velocity: startingVelocity };
  }

  // Method to add the first step for a specific plate
  async #addFirstStep(plateId: string) {
    const platesCollection = this.#universe.get(COLLECTIONS.PLATES);
    const planetsCollection = this.#universe.get(COLLECTIONS.PLANETS);

    const plate = await platesCollection.get(plateId);
    if (!plate) throw new Error(`Plate ${plateId} not found`);

    const planet = await planetsCollection.get(plate.planetId);
    if (!planet) throw new Error(`Planet ${plate.planetId} not found`);

    const stepId = uuidV4();

    const position = plate.position
      ? new Vector3(plate.position.x, plate.position.y, plate.position.z)
      : randomNormal().multiplyScalar(planet.radius);

    const { speed, velocity } = this.#initVelocity(planet.radius);

    const stepData = {
      id: stepId,
      plateId: plate.id,
      plateletId: plate.id,
      step: 0,
      speed, // Use provided speed or random between 5-250
      position,
      velocity,
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
    const steps = [...stepsGen];
    if (!steps.length) throw new Error('no steps found for plate');

    const result = steps.reduce(
      (latest, [_, value]) => {
        if (!latest) return value;
        return value.step > latest.step ? value : latest;
      },
      null as SimStepIF | null,
    );

    if (!result) throw new Error('no steps found for plate');
    return result;
  }

  /**
   * Move a specific plate to its next position
   * Uses ThreeOrbitalFrame to calculate the next position
   */
  async movePlate(plateId: string) {
    // Get the current step
    const currentStep = this.#getCurrentStep(plateId);

    // Get the plate and planet data
    const platesCollection = this.#universe.get(COLLECTIONS.PLATES);
    const planetsCollection = this.#universe.get(COLLECTIONS.PLANETS);

    const plate = await platesCollection.get(plateId);
    if (!plate) throw new Error(`Plate ${plateId} not found`);

    const planet = await planetsCollection.get(plate.planetId);
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

    // Update platelet steps
    const plateletStepsCollection = this.#universe.get(
      COLLECTIONS.PLATELET_STEPS,
    );
    if (!plateletStepsCollection)
      throw new Error('platelet_steps collection not found');

    const platelets = this.#universe.get(COLLECTIONS.PLATELETS);
    if (!platelets) throw new Error('platelets collection not found');

    const platePlatelets = platelets.find({ plateId });
    platePlatelets.forEach((platelet: Platelet) => {
      // Calculate new position based on plate movement
      const plateletPosition = platelet.position.clone();
      const newPlateletPosition = movePlate(
        {
          speed: currentStep.speed,
          velocity: new Vector3(
            orbitalFrame.axis.x,
            orbitalFrame.axis.y,
            orbitalFrame.axis.z,
          ),
          position: plateletPosition,
        },
        planet,
      );

      // Create new platelet step
      const plateletStep: PlateletStepIF = {
        id: uuidV4(),
        plateletId: platelet.id,
        plateId,
        step: currentStep.step + 1,
        position: newPlateletPosition,
        thickness: platelet.thickness,
        float: platelet.elevation || 0,
        h3Index: latLngToCell(newPlateletPosition.y, newPlateletPosition.x, 4),
        sector: latLngToCell(newPlateletPosition.y, newPlateletPosition.x, 0), // L0 cell for sector tracking
      };

      plateletStepsCollection.set(plateletStep.id, plateletStep);

      // Update platelet position
      platelet.position.copy(newPlateletPosition);
    });

    return newStep;
  }
}
