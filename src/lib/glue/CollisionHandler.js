import * as THREE from 'three';
import { OBB } from './OBB.js';

export class CollisionHandler {
  constructor(stage) {
    this.stage = stage;
  }

  handleCollisions(draggedObject) {
    const draggedOBB = new OBB(
      draggedObject.position.clone(),
      new THREE.Vector3(
        draggedObject.geometry.parameters.width / 2,
        draggedObject.geometry.parameters.height / 2,
        draggedObject.geometry.parameters.depth / 2
      ),
      new THREE.Matrix3().setFromMatrix4(draggedObject.matrixWorld)
    );
    let hasCollision = false;

    const maxIterations = 100; // Maximum number of iterations to prevent infinite loops
    const step = 0.1; // Define a small step to incrementally adjust the position
    let iteration = 0;

    const collidingObjects = new Set();

    // Function to check and handle intersections
    const checkIntersection = (selectedOBB, stage) => {
      let doesIntersect = false;
      let intersectingObject = null;

      for (let otherObject of stage.children) {
        if (otherObject !== draggedObject && otherObject.isMesh) {
          const otherOBB = new OBB(
            otherObject.position.clone(),
            new THREE.Vector3(
              otherObject.geometry.parameters.width / 2,
              otherObject.geometry.parameters.height / 2,
              otherObject.geometry.parameters.depth / 2
            ),
            new THREE.Matrix3().setFromMatrix4(otherObject.matrixWorld)
          );

          if (selectedOBB.intersectsOBB(otherOBB)) {
            doesIntersect = true;
            intersectingObject = otherObject;
            break;
          }
        }
      }

      return { doesIntersect, intersectingObject };
    };

    // Function to adjust position with minimal movement
    const adjustPosition = (object, otherOBB) => {
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
    };

    const handleStacking = (object, stackableObject) => {
      const stackableOBB = new OBB(
        stackableObject.position.clone(),
        new THREE.Vector3(
          stackableObject.geometry.parameters.width / 2,
          stackableObject.geometry.parameters.height / 2,
          stackableObject.geometry.parameters.depth / 2
        ),
        new THREE.Matrix3().setFromMatrix4(stackableObject.matrixWorld)
      );

      const draggedOBBMin = draggedOBB.center.clone().sub(draggedOBB.halfSize);
      const draggedOBBMax = draggedOBB.center.clone().add(draggedOBB.halfSize);

      const stackableOBBMax = stackableOBB.center.clone().add(stackableOBB.halfSize);

      // Ensure the object is placed directly on top of the stackable box
      if (draggedOBBMin.y < stackableOBBMax.y) {
        object.position.y = stackableOBBMax.y + draggedOBB.halfSize.y;
      }
    };

    // Iterate to adjust position until no collision is found or max iterations reached
    while (iteration < maxIterations) {
      hasCollision = false;
      collidingObjects.clear();

      this.stage.children.forEach(cube => {
        if (cube === draggedObject || !cube.isMesh) return;

        const otherOBB = new OBB(
          cube.position.clone(),
          new THREE.Vector3(
            cube.geometry.parameters.width / 2,
            cube.geometry.parameters.height / 2,
            cube.geometry.parameters.depth / 2
          ),
          new THREE.Matrix3().setFromMatrix4(cube.matrixWorld)
        );

        if (draggedOBB.intersectsOBB(otherOBB)) {
          if (cube.box.stackable && !cube.material.color.equals(new THREE.Color(0xff0000))) {
            handleStacking(draggedObject, cube);
          } else {
            hasCollision = true;
            collidingObjects.add(cube);
            adjustPosition(draggedObject, otherOBB);
          }
        }
      });

      if (!hasCollision) break;

      iteration++;
    }

    // Set colors based on collision state
    this.stage.children.forEach(cube => {
      if (collidingObjects.has(cube)) {
        cube.material.color.set(0xff0000); // Set colliding object color to red
      } else {
        if (cube.box.stackable) {
          cube.material.color.set(0x0000ff); // Keep stackable boxes blue
        } else {
          cube.material.color.set(0x00ff00); // Set non-colliding non-stackable object color to green
        }
      }
    });

    // Handle dragged object color separately
    if (hasCollision) {
      if (draggedObject.material && draggedObject.material.color) {
        draggedObject.material.color.set(0xff0000); // Set dragged object color to red
      }
    } else {
      if (draggedObject.material && draggedObject.material.color) {
        if (draggedObject.box.stackable) {
          draggedObject.material.color.set(0x0000ff); // Keep stackable dragged object blue
        } else {
          draggedObject.material.color.set(0x00ff00); // Set non-colliding dragged object color to green
        }
      }
    }
  }
}
