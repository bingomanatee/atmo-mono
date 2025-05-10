# atmo-three-tree

A utility package for managing hierarchical 3D nodes in a tree structure, with support for world and local coordinate transformations and integration with Multiverse for data persistence.

## Features

- Hierarchical tree structure for 3D nodes
- Each node has position and orientation ("front") properties
- World and relative position/orientation transformations
- Integration with Multiverse for data persistence
- Transform points between world and local coordinate spaces

## Installation

```bash
# Using npm
npm install @wonderlandlabs/atmo-three-tree

# Using yarn
yarn add @wonderlandlabs/atmo-three-tree
```

## Basic Usage

```typescript
import { TreeNode, ThreeTree } from '@wonderlandlabs/atmo-three-tree';
import { Vector3 } from 'three';

// Create a tree
const tree = new ThreeTree();

// Create nodes
const rootNode = tree.createNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }, // Identity quaternion
});

const childNode = tree.createNode({
  id: 'child',
  parentId: 'root',
  position: { x: 1, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});

// Get a node by ID
const node = tree.getNode('child');

// Get world position and orientation
const worldPos = node.worldPosition;
const worldOrientation = node.worldOrientation;

// Transform points between coordinate spaces
const worldPoint = new Vector3(2, 1, 0);
const localPoint = childNode.worldToLocal(worldPoint);
const backToWorld = childNode.localToWorld(localPoint);
// backToWorld should be nearly identical to worldPoint
```

## Integration with Multiverse

The package integrates with Multiverse for data persistence:

```typescript
import { ThreeTree } from '@wonderlandlabs/atmo-three-tree';
import { Multiverse, memorySunF } from '@wonderlandlabs/multiverse';

// Create a multiverse for data storage
const multiverse = new Multiverse(memorySunF);

// Create a tree with multiverse integration
const tree = new ThreeTree({
  multiverse,
  universeName: 'myUniverse',
  collectionName: 'treeNodes',
});

// Create nodes (automatically stored in multiverse)
const rootNode = tree.createNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
});

// Changes to nodes are automatically synced with multiverse
rootNode.setPosition({ x: 10, y: 0, z: 0 });

// Access the data directly from multiverse if needed
const universe = multiverse.get('myUniverse');
const collection = universe?.get('treeNodes');
const rootData = collection?.get('root');
```

## Coordinate Transformations

The package provides methods for transforming points between world and local coordinate spaces:

```typescript
import { ThreeTree, Vector3 } from '@wonderlandlabs/atmo-three-tree';

const tree = new ThreeTree();

// Create a hierarchy of nodes
const root = tree.createNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }, // Identity
});

const level1 = tree.createNode({
  id: 'level1',
  parentId: 'root',
  position: { x: 10, y: 0, z: 0 },
  // 90 degrees around Y axis
  orientation: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
});

// Transform a point from world to local space
const worldPoint = new Vector3(15, 5, 0);
const localPoint = level1.worldToLocal(worldPoint);

// Transform back to world space
const backToWorld = level1.localToWorld(localPoint);
```

## API

### ThreeTree

The main class for managing the tree structure.

#### Constructor

```typescript
constructor(options?: {
  multiverse?: Multiverse;
  universeName?: string;
  collectionName?: string;
})
```

#### Methods

- `createNode(data: Partial<TreeNodeData>): TreeNodeIF` - Create a new node in the tree
- `getNode(id: string): TreeNodeIF | undefined` - Get a node by ID
- `removeNode(id: string): boolean` - Remove a node from the tree
- `moveNode(id: string, newParentId?: string): boolean` - Move a node to a new parent
- `toData(): TreeNodeData[]` - Convert the tree to an array of node data objects
- `fromData(data: TreeNodeData[]): void` - Build the tree from an array of node data objects

### TreeNode

Represents a node in the 3D hierarchy.

#### Properties

- `id: string` - The unique identifier for the node
- `parentId?: string` - The ID of the parent node
- `parent?: TreeNodeIF` - Reference to the parent node
- `children: TreeNodeIF[]` - Array of child nodes
- `position: Vector3` - The node's local position
- `orientation: Quaternion` - The node's local orientation
- `worldPosition: Vector3` - The node's position in world coordinates
- `worldOrientation: Quaternion` - The node's orientation in world coordinates

#### Methods

- `setPosition(position: Vector3 | Point3D): void` - Set the node's local position
- `setOrientation(orientation: Quaternion | Orientation): void` - Set the node's local orientation
- `setWorldPosition(position: Vector3 | Point3D): void` - Set the node's position using world coordinates
- `setWorldOrientation(orientation: Quaternion | Orientation): void` - Set the node's orientation using world coordinates
- `addChild(node: TreeNodeIF): void` - Add a child node
- `removeChild(node: TreeNodeIF): void` - Remove a child node
- `localToWorld(point: Vector3 | Point3D): Vector3` - Transform a point from local to world coordinates
- `worldToLocal(point: Vector3 | Point3D): Vector3` - Transform a point from world to local coordinates
- `toData(): TreeNodeData` - Convert the node to a data object for storage
- `updateFromData(data: TreeNodeData): void` - Update the node from a data object

## Building and Testing

Run `yarn build` to build the library.

Run `yarn test` to execute the unit tests via [Vitest](https://vitest.dev).

## License

MIT
