# ThreeOrbitalFrame

`ThreeOrbitalFrame` is a utility class that extends Three.js `Object3D` to provide additional convenience methods for working with 3D transformations. It maintains full compatibility with the Three.js scene graph system while adding helpful methods for working with different position and orientation formats.

## Features

- Extends Three.js `Object3D` with all its built-in functionality
- Adds convenience methods for setting positions and orientations from different formats
- Provides methods for directly setting world-space transformations
- Maintains full compatibility with the Three.js scene graph system
- Supports method chaining for a fluent API

## Usage

### Basic Usage

```typescript
import { ThreeOrbitalFrame } from '@wonderlandlabs/atmo-three-orbit';
import { Vector3 } from 'three';

// Create nodes
const root = new ThreeOrbitalFrame('root', { x: 0, y: 0, z: 0 });
const child = new ThreeOrbitalFrame('child', { x: 5, y: 0, z: 0 });

// Build hierarchy using standard Object3D methods
root.add(child);

// Get world position
const worldPos = new Vector3();
child.getWorldPosition(worldPos);
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
```

### Method Chaining

```typescript
const node = new ThreeOrbitalFrame('node')
  .setPosition({ x: 1, y: 2, z: 3 })
  .setOrientation({ x: 0, y: 0, z: 0, w: 1 });
```

### Compatibility with Three.js

Since `ThreeOrbitalFrame` extends `Object3D`, it's fully compatible with all Three.js features:

```typescript
// Use with standard Three.js features
import { Scene, PerspectiveCamera, WebGLRenderer, Euler, MathUtils } from 'three';

// Create a scene
const scene = new Scene();

// Add ThreeOrbitalFrame to the scene
const node = new ThreeOrbitalFrame('node');
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
constructor(
  id?: string,
  position?: Vector3 | Point3D,
  orientation?: Quaternion | Orientation
)
```

- `id` - Optional string identifier (sets the `name` property)
- `position` - Optional initial position
- `orientation` - Optional initial orientation

### Methods

#### `setPosition(position: Vector3 | Point3D): this`

Sets the node's local position from either a Vector3 or a Point3D object.

#### `setOrientation(orientation: Quaternion | Orientation): this`

Sets the node's local orientation from either a Quaternion or an Orientation object.

#### `setWorldPosition(position: Vector3 | Point3D): this`

Sets the node's position in world space.

#### `setWorldOrientation(orientation: Quaternion | Orientation): this`

Sets the node's orientation in world space.

### Inherited from Object3D

ThreeOrbitalFrame inherits all properties and methods from Three.js Object3D, including:

- `position`, `rotation`, `quaternion`, `scale`
- `add()`, `remove()`
- `getWorldPosition()`, `getWorldQuaternion()`
- `worldToLocal()`, `localToWorld()`
- And many more - see the [Three.js Object3D documentation](https://threejs.org/docs/#api/en/core/Object3D)
