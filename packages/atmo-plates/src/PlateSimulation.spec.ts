import {
  CollAsync,
  CollSync,
  FIELD_TYPES,
  Multiverse,
  SchemaLocal,
  SchemaUniversal,
  Universe,
} from '@wonderlandlabs/multiverse';
import { v4 as uuidV4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';

describe('PlateSimulation', () => {
  let multiverse: Multiverse;
  let universe: Universe;
  let plateCollection: ColSync<any, string>;

  beforeEach(() => {
    // Create a universal schema for the 'plates' collection
    const universalSchema = new Map([
      [
        'plates',
        new SchemaUniversal('plates', {
          id: FIELD_TYPES.string,
          name: FIELD_TYPES.string,
          x: FIELD_TYPES.number,
          y: FIELD_TYPES.number,
          z: FIELD_TYPES.number,
        }),
      ],
    ]);

    // Set up the multiverse with the universal schema
    multiverse = new Multiverse(universalSchema);

    // Create a universe
    universe = new Universe('plate-universe', multiverse);

    // Create a collection for plates
    plateCollection = new CollSync({
      name: 'plates',
      universe,
      schema: new SchemaLocal('plates', {
        id: { type: FIELD_TYPES.string },
        name: { type: FIELD_TYPES.string, meta: { optional: true } },
        position: { type: FIELD_TYPES.object },
        'position.x': {
          type: FIELD_TYPES.number,
          universalName: 'x',
          exportOnly: true,
        },
        'position.y': {
          type: FIELD_TYPES.number,
          universalName: 'y',
          exportOnly: true,
        },
        'position.z': {
          type: FIELD_TYPES.number,
          universalName: 'z',
          exportOnly: true,
        },
      }),
    });
  });

  it('should create a plate', () => {
    const plateId = uuidV4();
    const plateData = {
      id: plateId,
      name: 'Test Plate',
      position: { x: 1, y: 2, z: 3 },
    };

    plateCollection.set(plateData.id, plateData);

    const retrievedPlate = plateCollection.get(plateId);
    expect(retrievedPlate).toEqual(plateData);
  });

  it('should update a plate', () => {
    const plateId = uuidV4();
    const initialPlateData = {
      id: plateId,
      position: { x: 1, y: 2, z: 3 },
    };

    plateCollection.set(plateId, initialPlateData);

    const updatedPlateData = {
      ...initialPlateData,
      name: 'Updated Test Plate',
      description: 'This is an updated test plate.',
    };

    plateCollection.set(plateId, updatedPlateData);

    const retrievedPlate = plateCollection.get(plateId);
    expect(retrievedPlate).toEqual(updatedPlateData);
  });

  it('should delete a plate', () => {
    const plateId = uuidV4();
    const plateData = {
      id: plateId,
      name: 'kill me',
      position: { x: 1, y: 2, z: 3 },
    };

    plateCollection.set(plateId, plateData);
    expect(plateCollection.has(plateId)).toBeTruthy();
    plateCollection.delete(plateId);
    expect(plateCollection.has(plateId)).toBeFalsy();
  });
});
