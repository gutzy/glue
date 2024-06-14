import { Box } from './objects/Box.js';
import { createOBB, adjustPosition } from './utils/OBBUtils.js';

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
    const stackableObjects = [];

    // Lock stacked items if the dragged object is stackable
    if (draggedObject.stackable) {
      draggedObject.lockStackedItems();
    }

    // Function to handle stacking recursively
    const handleStacking = (object, stackableObject, isStacked = false) => {
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
        if (object.stackedTo !== stackableObject) {
          if (object.stackedTo) {
            if (!isStacked) object.stackedTo.unstack(object);
          }
          if (!isStacked) stackableObject.stack(object);
        }
        else {
          // Update the relative position if the object is already stacked
            object.relativePosition = {
                x: object.position.x - stackableObject.position.x,
                y: object.position.y - stackableObject.position.y,
                z: object.position.z - stackableObject.position.z
            };
        }
        // Recursively stack items on top of the dragged object
        object.stackedItems.forEach(item => {
          handleStacking(item, stackableObject, true);
        });
      }
    };

    // Function to detach items that are no longer on top of a stackable box
    const detachItems = (object) => {
      this.stage.children.forEach(stackableBox => {
        if (stackableBox.stackable && stackableBox.stackedItems.has(object)) {
          if (!stackableBox.isItemStillStacked(object)) {
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
      stackableObjects.length = 0;

      this.stage.children.forEach(box => {
        if (box === draggedObject || box.locked || !box.isMesh) return;

        const otherOBB = createOBB(box);

        if (draggedOBB.intersectsOBB(otherOBB)) {
          if (box.stackable) {
            stackableObjects.push(box);
          } else {
            collidingObjects.add(box);
            hasCollision = true;
            // Prevent adjusting position if collision is with the stackedTo counterpart
            if (draggedObject.stackedTo !== box) {
              adjustPosition(draggedObject, draggedOBB, otherOBB, step);
            }
          }
        }
      });

      // Sort stackable objects by height to prioritize stacking on the highest box
      stackableObjects.sort((a, b) => a.position.y - b.position.y);

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
