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
            console.log(`Intersection detected between:`);
            console.log(`Dragged OBB - Center: ${selectedOBB.center.toArray()}, Half Size: ${selectedOBB.halfSize.toArray()}, Rotation: ${selectedOBB.rotation.elements}`);
            console.log(`Other OBB - Center: ${otherOBB.center.toArray()}, Half Size: ${otherOBB.halfSize.toArray()}, Rotation: ${otherOBB.rotation.elements}`);
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

      console.log(`Adjusting position:`);
      console.log(`Dragged OBB Min: ${draggedOBBMin.toArray()}, Max: ${draggedOBBMax.toArray()}`);
      console.log(`Other OBB Min: ${otherOBBMin.toArray()}, Max: ${otherOBBMax.toArray()}`);
      console.log(`Intersection Depth X: ${intersectionDepthX}, Z: ${intersectionDepthZ}`);

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
          hasCollision = true;
          collidingObjects.add(cube);

          // Adjust position with minimal movement
          adjustPosition(draggedObject, otherOBB);
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
        cube.material.color.set(0x00ff00); // Set non-colliding object color to green
      }
    });

    if (hasCollision) {
      if (draggedObject.material && draggedObject.material.color) {
        draggedObject.material.color.set(0xff0000); // Set dragged object color to red
      }
    } else {
      if (draggedObject.material && draggedObject.material.color) {
        draggedObject.material.color.set(0x00ff00); // Set dragged object color to green if no collision
      }
    }

    console.log(`Collision resolution completed. Final position: ${draggedObject.position.toArray()}`);
  }
}
