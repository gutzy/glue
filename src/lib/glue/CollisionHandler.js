import * as THREE from 'three';
import { Box } from './Box.js';
import { createOBB, adjustPosition } from './OBBUtils.js';

export class CollisionHandler {
  constructor(stage) {
    this.stage = stage;
    this.originalPositions = new Map();
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

    // Lock stacked items if the dragged object is stackable
    if (draggedObject.stackable) {
      draggedObject.lockStackedItems();
    }

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
        if (!this.originalPositions.has(object)) {
          this.originalPositions.set(object, {
            x: object.position.x - stackableObject.position.x,
            y: object.position.y - stackableObject.position.y,
            z: object.position.z - stackableObject.position.z
          });
        }
        stackableObject.stack(object);
      }
    };

    // Function to detach items that are no longer on top of a stackable box
    const detachItems = (object) => {
      this.stage.children.forEach(stackableBox => {
        if (stackableBox.stackable && stackableBox.stackedItems.has(object)) {
          if (!stackableBox.isItemStillStacked(object)) {
            console.log("Detaching object:", object);
            stackableBox.unstack(object);
            this.originalPositions.delete(object);
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
        if (box === draggedObject || box.locked || !box.isMesh) return;

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
      draggedObject.moveStackedItems();
      draggedObject.unlockStackedItems();
    }

    // Detach items that are no longer on top of a stackable box
    detachItems(draggedObject);

    // Set colors based on collision state
    this.stage.children.forEach(box => {
      if (box instanceof Box) box.setColorBasedOnCollision(collidingObjects, hasCollision && box === draggedObject);
    });
  }
}
