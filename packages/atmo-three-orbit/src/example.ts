import { ThreeTree } from './ThreeTree';
import { Vector3 } from 'three';
import { Multiverse, memorySunF } from '@wonderlandlabs/multiverse';

// Create a simple example of using the ThreeTree

// Create a multiverse for data storage
const multiverse = new Multiverse(memorySunF);

// Create a tree with multiverse integration
const tree = new ThreeTree({
  multiverse,
  universeName: 'example',
  collectionName: 'nodes'
});

// Create a root node
const root = tree.createNode({
  id: 'root',
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 } // Identity quaternion
});

// Create a child node
const child1 = tree.createNode({
  id: 'child1',
  parentId: 'root',
  position: { x: 5, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }
});

// Create another child with rotation
const child2 = tree.createNode({
  id: 'child2',
  parentId: 'root',
  position: { x: 0, y: 5, z: 0 },
  // 90 degrees around Y axis
  orientation: { x: 0, y: 0.7071, z: 0, w: 0.7071 }
});

// Create a grandchild
const grandchild = tree.createNode({
  id: 'grandchild',
  parentId: 'child1',
  position: { x: 2, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }
});

// Define a point in world space
const worldPoint = new Vector3(10, 2, 3);

// Transform to grandchild's local space
const localPoint = grandchild.worldToLocal(worldPoint);
console.log('World point:', worldPoint);
console.log('Local point in grandchild space:', localPoint);

// Transform back to world space
const backToWorld = grandchild.localToWorld(localPoint);
console.log('Back to world:', backToWorld);

// Check if the transformation is accurate
const distance = worldPoint.distanceTo(backToWorld);
console.log('Distance between original and transformed point:', distance);
// Should be very close to zero

// Get the world position of the grandchild
const grandchildWorldPos = grandchild.worldPosition;
console.log('Grandchild world position:', grandchildWorldPos);
// Should be (7, 0, 0) - root at (0,0,0) + child1 at (5,0,0) + grandchild at (2,0,0)

// Move the grandchild to a new parent
tree.moveNode('grandchild', 'child2');

// Get the new world position (should be different)
const newGrandchildWorldPos = grandchild.worldPosition;
console.log('Grandchild world position after moving:', newGrandchildWorldPos);

// Export the tree to data objects
const treeData = tree.toData();
console.log('Tree data:', JSON.stringify(treeData, null, 2));

// Example of how to access the data in the multiverse
const universe = multiverse.get('example');
const collection = universe?.get('nodes');
const rootData = collection?.get('root');
console.log('Root data from multiverse:', rootData);
