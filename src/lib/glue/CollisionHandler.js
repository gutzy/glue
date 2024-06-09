import * as THREE from 'three';
import { Box } from './Box.js';
import { createOBB, adjustPosition } from './OBBUtils.js';

export class CollisionHandler {
  constructor(stage) {
    this.stage = stage;
    this.originalPositions = new Map();
  }

  addBox(x, y, z, width, height, depth, rotation, stackable = false) {
    const box = new Box(x, y, z, width, height, depth, rotation, stackable);
    this.stage.add(box);
  }

  handleCollisions(draggedObject) {
    const draggedOBB = createOBB(draggedObject);
    let hasCollision = false;
    let isStacking = false;

    const maxIterations = 100; // Maximum number of iterations to prevent infinite loops
    const step = 0.1; // Define a small step to incrementally adjust the position
    let iteration = 0;

    const collidingObjects = new Set();
    const stackableObjects = new Set();

    // Function to handle stacking
    const handleStacking = (object, stackableObject) => {
      const stackableOBB = createOBB(stackableObject);

      const draggedOBBMin = draggedOBB.center.clone().sub(draggedOBB.halfSize);
      const stackableOBBMax = stackableOBB.center.clone().add(stackableOBB.halfSize);

      // Ensure the object is placed directly on top of the stackable box
      if (draggedOBBMin.y < stackableOBBMax.y) {
        object.position.y = stackableOBBMax.y + draggedOBB.halfSize.y;
        isStacking = true;

        // Track stacked items and their relative positions
        stackableObject.stackedItems.add(object);
        if (!this.originalPositions.has(object)) {
          this.originalPositions.set(object, {
            x: object.position.x - stackableObject.position.x,
            y: object.position.y - stackableObject.position.y,
            z: object.position.z - stackableObject.position.z
          });
        }
      }
    };

    // Function to detach items that are no longer on top of a stackable box
    const detachItems = (object) => {
      this.stage.children.forEach(stackableBox => {
        if (stackableBox.stackable && stackableBox.stackedItems.has(object)) {
          const originalPosition = this.originalPositions.get(object);
          const objectPositionRelativeToStackable = new THREE.Vector3(
            object.position.x - stackableBox.position.x,
            object.position.y - stackableBox.position.y,
            object.position.z - stackableBox.position.z
          );

          // If the object has moved significantly from its original relative position, detach it
          if (objectPositionRelativeToStackable.distanceTo(originalPosition) > 0.1) {
            stackableBox.stackedItems.delete(object);
            this.originalPositions.delete(object);
            object.material.color.set(0x00ff00); // Change color to green when detached
          }
        }
      });
    };

    // Iterate to adjust position until no collision is found or max iterations reached
    while (iteration < maxIterations) {
      hasCollision = false;
      isStacking = false;
      collidingObjects.clear();
      stackableObjects.clear();

      this.stage.children.forEach(box => {
        if (box === draggedObject || !box.isMesh) return;

        const otherOBB = createOBB(box);

        if (draggedOBB.intersectsOBB(otherOBB)) {
          if (box.stackable) {
            stackableObjects.add(box);
          } else {
            collidingObjects.add(box);
            hasCollision = true;
            adjustPosition(draggedObject, draggedOBB, otherOBB, step);
          }
        }
      });

      // Handle stacking after adjusting position
      stackableObjects.forEach(stackableObject => {
        handleStacking(draggedObject, stackableObject);
      });

      if (!hasCollision) break;

      iteration++;
    }

    // Move stacked items together with their parent stackable box
    if (draggedObject.stackable) {
      draggedObject.stackedItems.forEach(stackedItem => {
        const originalPosition = this.originalPositions.get(stackedItem);
        if (originalPosition) {
          stackedItem.position.set(
            draggedObject.position.x + originalPosition.x,
            draggedObject.position.y + originalPosition.y,
            draggedObject.position.z + originalPosition.z
          );
        }
      });
    }

    // Detach items that are no longer on top of a stackable box
    detachItems(draggedObject);

    // Set colors based on collision state
    this.stage.children.forEach(box => {
      if (box instanceof Box) box.setColorBasedOnCollision(collidingObjects, hasCollision && box === draggedObject);
    });
  }
}
