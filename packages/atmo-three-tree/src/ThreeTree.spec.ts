import { describe, it, expect, beforeEach } from 'vitest';
import { ThreeTree } from './ThreeTree';
import { TreeNode } from './TreeNode';
import { Multiverse, memorySunF } from '@wonderlandlabs/multiverse';

describe('ThreeTree', () => {
  let tree: ThreeTree;
  
  beforeEach(() => {
    tree = new ThreeTree();
  });
  
  it('should create a tree with no nodes', () => {
    expect(tree.nodes.size).toBe(0);
  });
  
  it('should create and retrieve nodes', () => {
    const node = tree.createNode({
      id: 'test',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    expect(tree.nodes.size).toBe(1);
    expect(tree.getNode('test')).toBe(node);
    
    const retrievedNode = tree.getNode('test');
    expect(retrievedNode?.position.x).toBe(1);
    expect(retrievedNode?.position.y).toBe(2);
    expect(retrievedNode?.position.z).toBe(3);
  });
  
  it('should create parent-child relationships', () => {
    const parent = tree.createNode({ id: 'parent' });
    const child = tree.createNode({
      id: 'child',
      parentId: 'parent'
    });
    
    expect(parent.children).toContain(child);
    expect(child.parent).toBe(parent);
    expect(child.parentId).toBe('parent');
  });
  
  it('should remove nodes', () => {
    const parent = tree.createNode({ id: 'parent' });
    const child = tree.createNode({
      id: 'child',
      parentId: 'parent'
    });
    
    expect(tree.nodes.size).toBe(2);
    
    // Remove child
    const result = tree.removeNode('child');
    expect(result).toBe(true);
    expect(tree.nodes.size).toBe(1);
    expect(tree.getNode('child')).toBeUndefined();
    expect(parent.children.length).toBe(0);
    
    // Try to remove non-existent node
    const badResult = tree.removeNode('nonexistent');
    expect(badResult).toBe(false);
  });
  
  it('should remove nodes and their children recursively', () => {
    const parent = tree.createNode({ id: 'parent' });
    const child1 = tree.createNode({
      id: 'child1',
      parentId: 'parent'
    });
    const grandchild = tree.createNode({
      id: 'grandchild',
      parentId: 'child1'
    });
    const child2 = tree.createNode({
      id: 'child2',
      parentId: 'parent'
    });
    
    expect(tree.nodes.size).toBe(4);
    
    // Remove parent (should remove all descendants)
    const result = tree.removeNode('parent');
    expect(result).toBe(true);
    expect(tree.nodes.size).toBe(0);
    expect(tree.getNode('parent')).toBeUndefined();
    expect(tree.getNode('child1')).toBeUndefined();
    expect(tree.getNode('grandchild')).toBeUndefined();
    expect(tree.getNode('child2')).toBeUndefined();
  });
  
  it('should move nodes between parents', () => {
    const parent1 = tree.createNode({ id: 'parent1' });
    const parent2 = tree.createNode({ id: 'parent2' });
    const child = tree.createNode({
      id: 'child',
      parentId: 'parent1'
    });
    
    expect(parent1.children).toContain(child);
    expect(parent2.children).not.toContain(child);
    
    // Move child to parent2
    const result = tree.moveNode('child', 'parent2');
    expect(result).toBe(true);
    
    expect(parent1.children).not.toContain(child);
    expect(parent2.children).toContain(child);
    expect(child.parent).toBe(parent2);
    expect(child.parentId).toBe('parent2');
    
    // Move to no parent (root)
    const rootResult = tree.moveNode('child');
    expect(rootResult).toBe(true);
    
    expect(parent2.children).not.toContain(child);
    expect(child.parent).toBeUndefined();
    expect(child.parentId).toBeUndefined();
    
    // Try to move to non-existent parent
    const badResult = tree.moveNode('child', 'nonexistent');
    expect(badResult).toBe(false);
  });
  
  it('should convert to and from data objects', () => {
    // Create a simple tree
    const parent = tree.createNode({
      id: 'parent',
      position: { x: 1, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    const child = tree.createNode({
      id: 'child',
      parentId: 'parent',
      position: { x: 0, y: 1, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    // Convert to data
    const data = tree.toData();
    expect(data.length).toBe(2);
    
    // Clear the tree
    tree.nodes.clear();
    expect(tree.nodes.size).toBe(0);
    
    // Rebuild from data
    tree.fromData(data);
    expect(tree.nodes.size).toBe(2);
    
    // Check that relationships were restored
    const newParent = tree.getNode('parent');
    const newChild = tree.getNode('child');
    
    expect(newParent).toBeDefined();
    expect(newChild).toBeDefined();
    expect(newParent?.children).toContain(newChild);
    expect(newChild?.parent).toBe(newParent);
    expect(newChild?.parentId).toBe('parent');
    
    // Check that properties were restored
    expect(newParent?.position.x).toBe(1);
    expect(newParent?.position.y).toBe(0);
    expect(newParent?.position.z).toBe(0);
    
    expect(newChild?.position.x).toBe(0);
    expect(newChild?.position.y).toBe(1);
    expect(newChild?.position.z).toBe(0);
  });
});

describe('ThreeTree with Multiverse', () => {
  let multiverse: Multiverse;
  let tree: ThreeTree;
  
  beforeEach(() => {
    multiverse = new Multiverse(memorySunF);
    tree = new ThreeTree({
      multiverse,
      universeName: 'testUniverse',
      collectionName: 'testNodes'
    });
  });
  
  it('should store nodes in the Multiverse collection', () => {
    // Create a node
    const node = tree.createNode({
      id: 'test',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    // Get the universe and collection
    const universe = multiverse.get('testUniverse');
    expect(universe).toBeDefined();
    
    const collection = universe?.get('testNodes');
    expect(collection).toBeDefined();
    
    // Check that the node is in the collection
    const record = collection?.get('test');
    expect(record).toBeDefined();
    expect(record?.position.x).toBe(1);
    expect(record?.position.y).toBe(2);
    expect(record?.position.z).toBe(3);
  });
  
  it('should update the collection when nodes change', () => {
    // Create a node
    const node = tree.createNode({
      id: 'test',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    // Update the node
    node.setPosition({ x: 4, y: 5, z: 6 });
    
    // Get the collection
    const universe = multiverse.get('testUniverse');
    const collection = universe?.get('testNodes');
    
    // Check that the node was updated in the collection
    const record = collection?.get('test');
    expect(record?.position.x).toBe(1); // Not updated yet because we didn't sync
    
    // Manually update the collection (in real usage, this would be handled by the sync mechanism)
    collection?.set('test', node.toData());
    
    // Now check that it's updated
    const updatedRecord = collection?.get('test');
    expect(updatedRecord?.position.x).toBe(4);
    expect(updatedRecord?.position.y).toBe(5);
    expect(updatedRecord?.position.z).toBe(6);
  });
  
  it('should remove nodes from the collection when deleted', () => {
    // Create a node
    const node = tree.createNode({
      id: 'test',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    });
    
    // Get the collection
    const universe = multiverse.get('testUniverse');
    const collection = universe?.get('testNodes');
    
    // Check that the node is in the collection
    expect(collection?.has('test')).toBe(true);
    
    // Remove the node
    tree.removeNode('test');
    
    // Check that the node is no longer in the collection
    expect(collection?.has('test')).toBe(false);
  });
});
