import { Box } from './objects/Box.js';
import { createOBB, adjustPosition } from './utils/OBBUtils.js';
import {Box2, Vector2, Vector3} from "three";

const NO_CLIPPING = true

export class CollisionHandler {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.originalPositions = new Map();
  }

  handleCollisions(draggedObject) {
    let draggedOBB = createOBB(draggedObject);
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
      if (object.uniqueId === stackableObject.uniqueId) {
        console.log('stacking self!!', object.uniqueId)
        return;
      }
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
          console.log('updating relative position', object.position)
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
      this.objectManager.children.forEach(stackableBox => {
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
      // Recompute OBB for the dragged object after any position changes from previous iteration
      draggedOBB = createOBB(draggedObject);

      this.objectManager.children.forEach(box => {
        if (box === draggedObject || box.locked || !box.isMesh) return;

        const otherOBB = createOBB(box);

        if (draggedOBB.intersectsOBB(otherOBB)) {

          if (box.snapsToSimilar && draggedObject.snapsToSimilar && box.meta.id === draggedObject.meta.id && box.rotation.equals(draggedObject.rotation)) {
            // Check if objects are at similar Y heights - disable snapping if heights differ significantly
            const yHeightDiff = Math.abs(draggedOBB.center.y - otherOBB.center.y);
            const maxHeight = Math.max(draggedOBB.halfSize.y, otherOBB.halfSize.y);
            const heightThreshold = maxHeight * 0.5; // Allow snapping if height difference is less than half the tallest object
            
            // Additional check: if the dragged object was originally stacked (has stackedTo property), 
            // be more restrictive about snapping to prevent unwanted edge connections
            const wasStacked = draggedObject.stackedTo !== null && draggedObject.stackedTo !== undefined;
            const restrictiveHeightThreshold = wasStacked ? maxHeight * 0.2 : heightThreshold;
            
            if (yHeightDiff > restrictiveHeightThreshold) {
              // Objects at different heights - skip similar object snapping entirely
              return;
            }

            // If both are stackable and dragged towards the center, prefer soft stacking over edge snapping
            if (draggedObject.stackable && box.stackable) {
              const dx = draggedOBB.center.x - otherOBB.center.x;
              const dz = draggedOBB.center.z - otherOBB.center.z;
              const centerDist = Math.hypot(dx, dz);
              const centerThreshold = Math.min(otherOBB.halfSize.x, otherOBB.halfSize.z) * 0.3;
              
              if (centerDist < centerThreshold) {
                // Apply soft center snapping - gentle pull toward center, not hard lock
                const softSnapStrength = 0.3; // How much to pull toward center (0 = no pull, 1 = hard snap)
                const targetX = box.position.x;
                const targetZ = box.position.z;
                draggedObject.position.x += (targetX - draggedObject.position.x) * softSnapStrength;
                draggedObject.position.z += (targetZ - draggedObject.position.z) * softSnapStrength;
                
                // Queue for stacking
                stackableObjects.push(box);
                return; // skip edge snapping when stacking is intended
              }
            }

            // Otherwise, default to edge snapping on four sides (only if at similar heights)
            const draggedOBBMin = draggedOBB.center.clone().sub(draggedOBB.halfSize);
            const otherOBBMin = otherOBB.center.clone().sub(otherOBB.halfSize);
            const draggedOBBSize = draggedOBB.halfSize.clone();
            const otherOBBSize = otherOBB.halfSize.clone();
            const closestEdge = draggedOBBMin.clone().add(draggedOBBSize).sub(otherOBBMin.clone().add(otherOBBSize));
            const closerToVerticalCenter = Math.abs(closestEdge.x) < Math.abs(closestEdge.z);
            // snap left edge to right edge
            if (!closerToVerticalCenter && draggedObject.position.x < box.position.x) {
              draggedObject.position.x = box.position.x - (draggedOBB.halfSize.x + otherOBB.halfSize.x);
              draggedObject.position.z = box.position.z;
            }
            // snap right edge to left edge
            else if (!closerToVerticalCenter && draggedObject.position.x > box.position.x) {
              draggedObject.position.x = box.position.x + (draggedOBB.halfSize.x + otherOBB.halfSize.x);
              draggedObject.position.z = box.position.z;
            }
            // snap front edge to back edge
            if (draggedObject.position.z < box.position.z) {
              draggedObject.position.z = box.position.z - (draggedOBB.halfSize.z + otherOBB.halfSize.z);
              draggedObject.position.x = box.position.x;
            }
            // snap back edge to front edge
            else if (draggedObject.position.z > box.position.z) {
              draggedObject.position.z = box.position.z + (draggedOBB.halfSize.z + otherOBB.halfSize.z);
              draggedObject.position.x = box.position.x;
            }
          }

          else if (box.stackable) {
            const dx = draggedOBB.center.x - otherOBB.center.x;
            const dz = draggedOBB.center.z - otherOBB.center.z;
            const centerDist = Math.hypot(dx, dz);
            const centerThreshold = Math.min(otherOBB.halfSize.x, otherOBB.halfSize.z) * 0.3;
            if (centerDist < centerThreshold) {
              // Apply soft center snapping for stackable objects
              const softSnapStrength = 0.3; // Gentle pull toward center
              const targetX = box.position.x;
              const targetZ = box.position.z;
              draggedObject.position.x += (targetX - draggedObject.position.x) * softSnapStrength;
              draggedObject.position.z += (targetZ - draggedObject.position.z) * softSnapStrength;
              
              stackableObjects.push(box);
              return;
            }
            stackableObjects.push(box);
          } else {

            if (!NO_CLIPPING) {
              collidingObjects.add(box);

              hasCollision = true;
              // Prevent adjusting position if collision is with the stackedTo counterpart
              if (draggedObject.stackedTo !== box) {
                adjustPosition(draggedObject, draggedOBB, otherOBB, step);
              }
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
      // If stacking occurred, iterate again to allow climbing to the topmost stack
      if (isStacking) {
        hasCollision = true;
      }

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
    this.objectManager.children.forEach(box => {
      if (box instanceof Box) box.setColorBasedOnCollision(collidingObjects, hasCollision && box === draggedObject);
    });

    draggedObject.dispatchEvent({ type: 'change' });

  }

  // used when an item below a certain item is removed, this will drop the top item to the ground
  dropGap(stackedItem, originalItem) {
    // Calculate proper ground position: half the object's height above ground (Y=0)
    const groundY = stackedItem.geometry.parameters.height / 2;
    stackedItem.position.y = groundY;
    // Clear stacking relationship
    stackedItem.stackedTo = null;
    delete stackedItem.relativePosition;
    stackedItem.dispatchEvent({ type: 'change' });
  }
}
