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
  size: number; // Size/radius of the platelet
  density: number; // Mass per unit volume

  // State
  velocity: Vector3;
  isActive: boolean; // Whether this platelet is currently participating in physics

  // Connection properties
  neighbors: string[]; // IDs of connected platelets
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
    size: options.size ?? 1.0,
    density: options.density ?? 1.0,
    velocity: options.velocity?.clone() ?? new Vector3(),
    isActive: options.isActive ?? true,
    neighbors: options.neighbors ?? [],
    connections: options.connections ?? {},
    ...options,
  };
}

// Helper function to connect two platelets
export function connectPlatelets(
  platelet1: Platelet,
  platelet2: Platelet,
  strength: number = 1.0,
): void {
  const distance = platelet1.position.distanceTo(platelet2.position);

  // Add to neighbors list
  if (!platelet1.neighbors.includes(platelet2.id)) {
    platelet1.neighbors.push(platelet2.id);
  }
  if (!platelet2.neighbors.includes(platelet1.id)) {
    platelet2.neighbors.push(platelet1.id);
  }

  // Add connection details
  platelet1.connections[platelet2.id] = {
    distance,
    strength,
    isActive: true,
  };
  platelet2.connections[platelet1.id] = {
    distance,
    strength,
    isActive: true,
  };
}

// Helper function to subdivide a plate into platelets
export function subdividePlate(
  plateId: string,
  center: Vector3,
  radius: number,
  subdivisions: number,
  options: Partial<Platelet> = {},
): Platelet[] {
  const platelets: Platelet[] = [];
  const angleStep = (2 * Math.PI) / subdivisions;

  // Create platelets in a circle
  for (let i = 0; i < subdivisions; i++) {
    const angle = i * angleStep;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    const z = center.z;

    platelets.push(createPlatelet(plateId, new Vector3(x, y, z), options));
  }

  // Connect adjacent platelets
  for (let i = 0; i < platelets.length; i++) {
    const nextIndex = (i + 1) % platelets.length;
    connectPlatelets(platelets[i], platelets[nextIndex]);
  }

  return platelets;
}
