# TreeNode

`TreeNode` is a class that extends Three.js `Object3D` to provide a hierarchical tree structure for 3D nodes with support for world and local coordinate transformations and integration with Multiverse for data persistence.

## Features

- Extends Three.js `Object3D` with all its built-in functionality
- Maintains compatibility with the TreeNodeIF interface
- Provides methods for directly setting world-space transformations
- Supports serialization to/from data objects for persistence
- Maintains parent-child relationships with string IDs

## Usage

### Basic Usage

```typescript
import { TreeNode } from '@wonderlandlabs/atmo-three-orbit';

// Create nodes
const root = new TreeNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }
});

const child = new TreeNode({
  id: 'child',
  position: { x: 5, y: 0, z: 0 }
});

// Build hierarchy
root.addChild(child);

// Get world position
const worldPos = child.worldPosition;
console.log(worldPos); // Vector3(5, 0, 0)
```

### Setting Positions and Orientations

```typescript
// Set position using Point3D object
node.setPosition({ x: 1, y: 2, z: 3 });

// Set position using Vector3
const position = new Vector3(4, 5, 6);
node.setPosition(position);

// Set orientation using Quaternion
const quaternion = new Quaternion();
quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI/2);
node.setOrientation(quaternion);

// Set orientation using Orientation object
node.setOrientation({ x: 0, y: 0.7071, z: 0, w: 0.7071 });
```

### World Space Transformations

```typescript
// Set position in world space
node.setWorldPosition({ x: 10, y: 10, z: 10 });

// Set orientation in world space
const worldOrientation = new Quaternion();
worldOrientation.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI/2);
node.setWorldOrientation(worldOrientation);

// Get world position and orientation
const worldPos = node.worldPosition;
const worldRot = node.worldOrientation;
```

### Data Serialization

```typescript
// Convert node to data object
const data = node.toData();
console.log(data);
// {
//   id: 'node1',
//   parentId: 'parent1',
//   position: { x: 1, y: 2, z: 3 },
//   orientation: { x: 0, y: 0, z: 0, w: 1 },
//   children: ['child1', 'child2']
// }

// Create a node from data
const newNode = new TreeNode(data);

// Update a node from data
node.updateFromData(data);
```

### Compatibility with Three.js

Since `TreeNode` extends `Object3D`, it's fully compatible with all Three.js features:

```typescript
// Use with standard Three.js features
import { Scene, PerspectiveCamera, WebGLRenderer, Euler, MathUtils } from 'three';

// Create a scene
const scene = new Scene();

// Add TreeNode to the scene
const node = new TreeNode({ id: 'node1' });
scene.add(node);

// Use Euler angles
node.rotation.set(0, Math.PI/2, 0);

// Convert quaternion to Euler angles
const euler = new Euler();
euler.setFromQuaternion(node.quaternion);
console.log('Rotation in degrees:',
  MathUtils.radToDeg(euler.x),
  MathUtils.radToDeg(euler.y),
  MathUtils.radToDeg(euler.z)
);
```

## API

### Constructor

```typescript
constructor(data: Partial<TreeNodeData>)
```

- `data` - Object containing node data:
  - `id` - Optional string identifier (generated if not provided)
  - `parentId` - Optional ID of parent node
  - `position` - Optional initial position
  - `orientation` - Optional initial orientation

### Properties

- `id: string` - Unique identifier for the node
- `parentId?: string` - ID of the parent node
- `parent?: TreeNodeIF` - Reference to the parent node
- `children: TreeNodeIF[]` - Array of child nodes
- `position: Vector3` - Local position (inherited from Object3D)
- `quaternion: Quaternion` - Local orientation (inherited from Object3D)
- `orientation: Quaternion` - Alias for quaternion
- `worldPosition: Vector3` - Position in world space
- `worldOrientation: Quaternion` - Orientation in world space

### Methods

#### `setPosition(position: Vector3 | Point3D): void`

Sets the node's local position from either a Vector3 or a Point3D object.

#### `setOrientation(orientation: Quaternion | Orientation): void`

Sets the node's local orientation from either a Quaternion or an Orientation object.

#### `setWorldPosition(position: Vector3 | Point3D): void`

Sets the node's position in world space.

#### `setWorldOrientation(orientation: Quaternion | Orientation): void`

Sets the node's orientation in world space.

#### `addChild(node: TreeNodeIF): void`

Adds a child node to this node.

#### `removeChild(node: TreeNodeIF): void`

Removes a child node from this node.

#### `localToWorld(point: Vector3 | Point3D): Vector3`

Transforms a point from local to world coordinates.

#### `worldToLocal(point: Vector3 | Point3D): Vector3`

Transforms a point from world to local coordinates.

#### `toData(): TreeNodeData`

Converts the node to a data object for storage.

#### `updateFromData(data: TreeNodeData): void`

Updates the node from a data object.

### Inherited from Object3D

TreeNode inherits all properties and methods from Three.js Object3D, including:

- `rotation`, `scale`, `matrix`, `matrixWorld`
- `add()`, `remove()`
- `getWorldPosition()`, `getWorldQuaternion()`
- `updateMatrix()`, `updateMatrixWorld()`
- And many more - see the [Three.js Object3D documentation](https://threejs.org/docs/#api/en/core/Object3D)
