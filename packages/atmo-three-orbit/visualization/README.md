# TreeNode Visualization

This is a visualization of the TreeNode class from the atmo-three-tree package. It shows a hierarchy of nodes with:

- Magenta cones representing up vectors
- Flat blue cylinders representing node positions
- Two levels of child nodes that rotate around their parents

## Running the Visualization

1. Navigate to this directory:

   ```
   cd packages/atmo-three-tree/src/visualization
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Start the development server:

   ```
   npm start
   ```

4. Open your browser to the URL shown in the terminal (usually http://localhost:5173)

## Building for Production

To create a production build:

1. Navigate to this directory:

   ```
   cd packages/atmo-three-tree/src/visualization
   ```

2. Build the project:

   ```
   npm run build
   ```

3. The built files will be in the `dist` directory. You can serve them with any static file server:
   ```
   npm run preview
   ```

## Features

- **TreeNode Hierarchy**: Demonstrates the parent-child relationships between TreeNodes
- **Up Vectors**: Shows how each node maintains its own up vector (magenta cones)
- **Orientation**: Nodes automatically orient themselves based on their position relative to their parent
- **Animation**: Demonstrates the `updatePosition` method with continuous repositioning

## Controls

- **Mouse Drag**: Rotate the camera
- **Mouse Wheel**: Zoom in/out
- **Right Mouse Drag**: Pan the camera

## Implementation Details

This visualization uses the actual TreeNode class from the atmo-three-tree package. Each node is enhanced with visual elements (cylinder and cone) to make the node positions and orientations visible.

The `reposition` function is called on each animation frame to update the positions of all nodes, demonstrating how TreeNodes maintain their orientation when their position changes.
