import * as THREE from 'three';
import { OBB } from './OBB.js';

export function createOBB(object) {
  return new OBB(
    object.position.clone(),
    new THREE.Vector3(
      object.geometry.parameters.width / 2,
      object.geometry.parameters.height / 2,
      object.geometry.parameters.depth / 2
    ),
    new THREE.Matrix3().setFromMatrix4(object.matrixWorld)
  );
}

export function checkIntersection(draggedOBB, stage, draggedObject) {
  let doesIntersect = false;
  let intersectingObject = null;

  stage.children.forEach(otherObject => {
    if (otherObject !== draggedObject && otherObject.isMesh) {
      const otherOBB = createOBB(otherObject);

      if (draggedOBB.intersectsOBB(otherOBB)) {
        doesIntersect = true;
        intersectingObject = otherObject;
      }
    }
  });

  return { doesIntersect, intersectingObject };
}

export function adjustPosition(object, draggedOBB, otherOBB, step) {
  const draggedOBBMin = draggedOBB.center.clone().sub(draggedOBB.halfSize);
  const draggedOBBMax = draggedOBB.center.clone().add(draggedOBB.halfSize);
  const otherOBBMin = otherOBB.center.clone().sub(otherOBB.halfSize);
  const otherOBBMax = otherOBB.center.clone().add(otherOBB.halfSize);

  const intersectionDepthX = Math.min(
    Math.abs(draggedOBBMax.x - otherOBBMin.x),
    Math.abs(otherOBBMax.x - draggedOBBMin.x)
  );

  const intersectionDepthZ = Math.min(
    Math.abs(draggedOBBMax.z - otherOBBMin.z),
    Math.abs(otherOBBMax.z - draggedOBBMin.z)
  );

  if (intersectionDepthX < intersectionDepthZ) {
    if (draggedOBBMin.x < otherOBBMin.x) {
      object.position.x -= intersectionDepthX + step;
    } else {
      object.position.x += intersectionDepthX + step;
    }
  } else {
    if (draggedOBBMin.z < otherOBBMin.z) {
      object.position.z -= intersectionDepthZ + step;
    } else {
      object.position.z += intersectionDepthZ + step;
    }
  }

  draggedOBB.set(object.position.clone(), draggedOBB.halfSize, new THREE.Matrix3().setFromMatrix4(object.matrixWorld));
}

export function handleStacking(object, stackableObject, draggedOBB, stackedItems, originalPositions) {
  const stackableOBB = createOBB(stackableObject);

  const draggedOBBMin = draggedOBB.center.clone().sub(draggedOBB.halfSize);
  const stackableOBBMax = stackableOBB.center.clone().add(stackableOBB.halfSize);

  // Ensure the object is placed directly on top of the stackable box
  if (draggedOBBMin.y < stackableOBBMax.y) {
    object.position.y = stackableOBBMax.y + draggedOBB.halfSize.y;

    // Track stacked items and their relative positions
    if (!stackedItems.has(stackableObject)) {
      stackedItems.set(stackableObject, new Set());
    }
    stackedItems.get(stackableObject).add(object);
    if (!originalPositions.has(object)) {
      originalPositions.set(object, {
        x: object.position.x - stackableObject.position.x,
        y: object.position.y - stackableObject.position.y,
        z: object.position.z - stackableObject.position.z
      });
    }
  }
}
