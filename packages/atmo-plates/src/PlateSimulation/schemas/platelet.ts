import { Vector3 } from 'three';

export interface Platelet {
  // Unique identifier for the platelet
  id: string;

  // H3 cell ID for this platelet's location
  h3Cell?: string;

  // Position in 3D space
  position: Vector3;

  // Reference to parent plate
  plateId: string;

  // Physical properties
  mass: number;
  elasticity: number; // 0-1 range, where 1 is perfectly elastic
  radius: number; // Radius of the platelet
  density: number; // Mass per unit volume
  thickness: number; // thisness in km
  elevation?: number; // Floating elevation in kilometers

  // State
  velocity: Vector3;
  isActive: boolean; // Whether this platelet is currently participating in physics

  // Connection properties
  neighbors: string[]; // IDs of connected platelets
  neighborCellIds: string[]; // H3 cell IDs of neighboring platelets
  connections: {
    // Detailed connection information
    [plateletId: string]: {
      distance: number; // Distance to neighbor
      strength: number; // Connection strength (0-1)
      isActive: boolean; // Whether connection is active
    };
  };

  // Optional properties for future use
  temperature?: number;
  pressure?: number;
  stress?: number;
  strain?: number; // Deformation relative to original shape
  material?: string; // Material type for different properties
}

// Helper function to create a new platelet
export function createPlatelet(
  plateId: string,
  position: Vector3,
  options: Partial<Platelet> = {},
): Platelet {
  return {
    id: crypto.randomUUID(),
    position: position.clone(),
    plateId,
    mass: options.mass ?? 1.0,
    elasticity: options.elasticity ?? 0.5,
    radius: options.radius ?? 1.0,
    density: options.density ?? 1.0,
    velocity: options.velocity?.clone() ?? new Vector3(),
    isActive: options.isActive ?? true,
    neighbors: options.neighbors ?? [],
    neighborCellIds: options.neighborCellIds ?? [],
    connections: options.connections ?? {},
    ...options,
  };
}
