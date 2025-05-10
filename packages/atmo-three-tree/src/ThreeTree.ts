import { CollSync, Multiverse, SchemaLocal, SchemaUniversal, FIELD_TYPES } from '@wonderlandlabs/multiverse';
import { TreeNode } from './TreeNode';
import { ThreeTreeIF, TreeNodeData, TreeNodeIF } from './types';

/**
 * Schema for tree node data in the Multiverse collection
 */
const TREE_NODE_SCHEMA = {
  id: FIELD_TYPES.string,
  parentId: { type: FIELD_TYPES.string, meta: { optional: true } },
  position: {
    type: FIELD_TYPES.object,
    meta: {
      fields: {
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number
      }
    }
  },
  orientation: {
    type: FIELD_TYPES.object,
    meta: {
      fields: {
        x: FIELD_TYPES.number,
        y: FIELD_TYPES.number,
        z: FIELD_TYPES.number,
        w: FIELD_TYPES.number
      }
    }
  },
  children: {
    type: FIELD_TYPES.array,
    meta: {
      itemType: FIELD_TYPES.string,
      optional: true
    }
  }
};

/**
 * A class for managing a hierarchy of 3D nodes in a tree structure
 */
export class ThreeTree implements ThreeTreeIF {
  nodes: Map<string, TreeNodeIF> = new Map();
  #multiverse?: Multiverse;
  #collection?: CollSync<TreeNodeData>;
  
  /**
   * Create a new ThreeTree
   * 
   * @param options Configuration options
   */
  constructor(options: {
    multiverse?: Multiverse;
    universeName?: string;
    collectionName?: string;
  } = {}) {
    const { multiverse, universeName = 'default', collectionName = 'treeNodes' } = options;
    
    if (multiverse) {
      this.#multiverse = multiverse;
      
      // Create universal schema
      const universalSchema = new SchemaUniversal<TreeNodeData>(
        collectionName,
        TREE_NODE_SCHEMA
      );
      
      // Create local schema (same as universal in this case)
      const localSchema = new SchemaLocal<TreeNodeData>(
        collectionName,
        TREE_NODE_SCHEMA,
        {
          // Field name mappings (none needed as we use the same structure)
        }
      );
      
      // Get or create universe
      let universe = this.#multiverse.get(universeName);
      if (!universe) {
        universe = this.#multiverse.create(universeName);
      }
      
      // Create collection
      this.#collection = new CollSync<TreeNodeData>(
        collectionName,
        universe,
        localSchema
      );
      
      // Load initial data
      this.#loadFromCollection();
      
      // Subscribe to changes
      this.#collection.subscribe((event) => {
        if (event.type === 'add' || event.type === 'update') {
          this.#handleNodeDataChange(event.record);
        } else if (event.type === 'remove') {
          this.#handleNodeDataRemove(event.key as string);
        }
      });
    }
  }
  
  /**
   * Create a new node in the tree
   */
  createNode(data: Partial<TreeNodeData>): TreeNodeIF {
    const node = new TreeNode(data);
    this.nodes.set(node.id, node);
    
    // Connect to parent if specified
    if (data.parentId) {
      const parent = this.nodes.get(data.parentId);
      if (parent) {
        parent.addChild(node);
      }
    }
    
    // Save to collection if available
    if (this.#collection) {
      this.#collection.set(node.id, node.toData());
    }
    
    return node;
  }
  
  /**
   * Get a node by ID
   */
  getNode(id: string): TreeNodeIF | undefined {
    return this.nodes.get(id);
  }
  
  /**
   * Remove a node from the tree
   */
  removeNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }
    
    // Remove from parent
    if (node.parent) {
      node.parent.removeChild(node);
    }
    
    // Remove all children recursively
    const childrenToRemove = [...node.children];
    for (const child of childrenToRemove) {
      this.removeNode(child.id);
    }
    
    // Remove from nodes map
    this.nodes.delete(id);
    
    // Remove from collection if available
    if (this.#collection) {
      this.#collection.delete(id);
    }
    
    return true;
  }
  
  /**
   * Move a node to a new parent
   */
  moveNode(id: string, newParentId?: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }
    
    // Remove from current parent
    if (node.parent) {
      node.parent.removeChild(node);
    }
    
    // Add to new parent if specified
    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (!newParent) {
        return false;
      }
      newParent.addChild(node);
    }
    
    // Update collection if available
    if (this.#collection) {
      this.#collection.set(node.id, node.toData());
    }
    
    return true;
  }
  
  /**
   * Convert the tree to an array of node data objects
   */
  toData(): TreeNodeData[] {
    return Array.from(this.nodes.values()).map(node => node.toData());
  }
  
  /**
   * Build the tree from an array of node data objects
   */
  fromData(data: TreeNodeData[]): void {
    // Clear existing nodes
    this.nodes.clear();
    
    // First pass: create all nodes
    for (const nodeData of data) {
      const node = new TreeNode(nodeData);
      this.nodes.set(node.id, node);
    }
    
    // Second pass: establish parent-child relationships
    for (const nodeData of data) {
      if (nodeData.parentId) {
        const node = this.nodes.get(nodeData.id);
        const parent = this.nodes.get(nodeData.parentId);
        
        if (node && parent) {
          parent.addChild(node);
        }
      }
    }
    
    // Update collection if available
    if (this.#collection) {
      for (const node of this.nodes.values()) {
        this.#collection.set(node.id, node.toData());
      }
    }
  }
  
  /**
   * Load nodes from the Multiverse collection
   */
  #loadFromCollection(): void {
    if (!this.#collection) {
      return;
    }
    
    // Get all records from the collection
    const records = this.#collection.getAll();
    
    // Build the tree from the records
    this.fromData(Array.from(records.values()));
  }
  
  /**
   * Handle a node data change event from the collection
   */
  #handleNodeDataChange(data: TreeNodeData): void {
    let node = this.nodes.get(data.id);
    
    if (node) {
      // Update existing node
      node.updateFromData(data);
      
      // Update parent relationship if needed
      if (node.parentId !== data.parentId) {
        if (node.parent) {
          node.parent.removeChild(node);
        }
        
        if (data.parentId) {
          const parent = this.nodes.get(data.parentId);
          if (parent) {
            parent.addChild(node);
          }
        }
      }
    } else {
      // Create new node
      node = new TreeNode(data);
      this.nodes.set(node.id, node);
      
      // Connect to parent if specified
      if (data.parentId) {
        const parent = this.nodes.get(data.parentId);
        if (parent) {
          parent.addChild(node);
        }
      }
    }
  }
  
  /**
   * Handle a node data remove event from the collection
   */
  #handleNodeDataRemove(id: string): void {
    this.removeNode(id);
  }
}
