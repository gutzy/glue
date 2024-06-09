import * as THREE from 'three';

export class Box extends THREE.Mesh {
  constructor(x, y, z, width, height, depth, rotation = 0, stackable = false) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshBasicMaterial({ color: stackable ? 0x0000ff : 0x00ff00, wireframe: true });
    super(geometry, material);

    this.position.set(x, y, z);
    // put on floor
    this.position.y += height / 2;
    this.rotation.y = THREE.MathUtils.degToRad(rotation);
    this.stackable = stackable;
    this.stackedItems = new Set();
  }

  setColor(color) {
    this.material.color.set(color);
  }

  setColorBasedOnCollision(collidingObjects, isDragging = false) {
    if (collidingObjects.has(this)) {
      this.setColor(0xff0000); // Set colliding object color to red
    } else {
      if (this.stackable) {
        this.setColor(0x0000ff); // Keep stackable boxes blue
      } else {
        this.setColor(0x00ff00); // Set non-colliding non-stackable object color to green
      }
    }

    if (isDragging) {
      this.setColor(0xff0000); // Set dragged object color to red if there is a collision
    }
  }
}
