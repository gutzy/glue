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
    this.stackedTo = null;
    this.stackedItems = new Set();
  }

  stack(object) {
    this.stackedItems.add(object);
    object.setColor(0xffff00); // Change color to yellow when stacked
    object.relativePosition = {
      x: object.position.x - this.position.x,
      y: object.position.y - this.position.y,
      z: object.position.z - this.position.z
    };
    object.stackedTo = this;
    console.log(`Stacked ${object.uuid} on ${this.uuid}`);
  }

  unstack(object) {
    this.stackedItems.delete(object);
    object.stackedTo = null;
    console.log('Unstacked object:', object);
    object.updateColor(); // Update color of the unstacked object
    delete object.relativePosition;
  }

  updateColor() {
    if (this.stackedItems.size > 0) {
      this.setColor(0x0000ff); // Keep stackable boxes blue
    } else {
      this.setColor(this.stackable ? 0x0000ff :
        this.stackedTo ? 0xffff00 : 0x00ff00
      ); // Reset to blue or green
    }
  }

  setColor(color) {
    this.material.color.set(color);
  }

  setColorBasedOnCollision(collidingObjects, isDragging = false) {
    if (collidingObjects.has(this)) {
      this.setColor(0xff0000); // Set colliding object color to red
    } else {
      this.updateColor();
    }

    if (isDragging) {
      this.setColor(0xff0000); // Set dragged object color to red if there is a collision
    }
  }

  lockStackedItems() {
    this.stackedItems.forEach(item => item.locked = true);
  }

  unlockStackedItems() {
    this.stackedItems.forEach(item => item.locked = false);
  }

  moveStackedItems() {
    this.stackedItems.forEach(item => {
      item.position.set(
        this.position.x + item.relativePosition.x,
        this.position.y + item.relativePosition.y,
        this.position.z + item.relativePosition.z
      );
      console.log(`Moved stacked item ${item.uuid} to (${item.position.x}, ${item.position.y}, ${item.position.z})`);
    });
  }

  isItemStillStacked(item) {
    const itemBox = new THREE.Box3().setFromObject(item);
    const thisBox = new THREE.Box3().setFromObject(this);

    // allow the item to move slightly
    thisBox.min.y -= 0.1;
    thisBox.max.y += 0.1;

    return thisBox.intersectsBox(itemBox);
  }
}
