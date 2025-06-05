import { Forest, ObjectCollection } from '@wonderlandlabs/forestry';
import { PLATE_STATUS, type PlateStatus } from '../constants/statusTypes';

export interface PlateState {
  id: string;
  status: PlateStatus;
  plateletCount: number;
  progress: number;
  createdAt?: number;
  updatedAt?: number;
}

export function createPlatesCollection(forest: Forest) {
  return new ObjectCollection<string, PlateState>(
    'plates',
    { initial: {} },
    {
      updatePlate(collection, id: string, updates: Partial<PlateState>) {
        const existing = collection.get(id);
        if (existing) {
          collection.set(id, { ...existing, ...updates });
        }
      },
      incrementPlateletCount(collection, plateId: string, count: number = 1) {
        const existing = collection.get(plateId);
        if (existing) {
          collection.set(plateId, {
            ...existing,
            plateletCount: (existing.plateletCount || 0) + count,
            updatedAt: Date.now(),
          });
        }
      },
      updateProgress(
        collection,
        plateId: string,
        progress: number,
        plateletCount?: number,
      ) {
        const existing = collection.get(plateId);
        if (existing) {
          collection.set(plateId, {
            ...existing,
            progress,
            ...(plateletCount !== undefined && { plateletCount }),
            updatedAt: Date.now(),
          });
        }
      },
      markComplete(collection, plateId: string, finalCount: number) {
        const existing = collection.get(plateId);
        if (existing) {
          collection.set(plateId, {
            ...existing,
            status: PLATE_STATUS.COMPLETE,
            progress: 1,
            plateletCount: finalCount,
            updatedAt: Date.now(),
          });
        }
      },
      // Action selectors for computed values
      getTotalPlatelets(collection) {
        return Array.from(collection.values()).reduce(
          (sum, plate) => sum + (plate.plateletCount || 0),
          0,
        );
      },
      getTotalPlates(collection) {
        return collection.size;
      },
      getCompletePlates(collection) {
        return Array.from(collection.values()).filter(
          (p) => p.status === PLATE_STATUS.COMPLETE,
        );
      },
      getActivePlates(collection) {
        return Array.from(collection.values()).filter(
          (p) => p.status === PLATE_STATUS.GENERATING_PLATELETS,
        );
      },
    },
    forest,
  );
}
