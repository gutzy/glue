import * as THREE from 'three';

export class Box extends THREE.Mesh {
  constructor(x, y, z, width, height, depth, rotation = 0, stackable = false, snapsToSimilar = false) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshBasicMaterial({ color: stackable ? 0x0000ff : 0x00ff00, wireframe: true });
    super(geometry, material);

    this.position.set(x, y, z);
    this.position.y += height / 2;  // Ensure it is on the floor
    this.rotation.y = THREE.MathUtils.degToRad(rotation);
    this.stackable = stackable;
    this.snapsToSimilar = snapsToSimilar;
    this.stackedTo = null;
    this.stackedItems = new Set();
    this.type = 'box'
  }

  setPosition(x, y, z) {
    if  (y === null) { // assume it's on the ground?
      y = this.geometry.parameters.height / 2
    }
    this.position.set(x, y, z);
    this.dispatchEvent({ type: 'change' });
    this.moveStackedItems();
  }

  setRotation(rotation) {
    let lastRotation = this.rotation.y;
    this.rotation.y = THREE.MathUtils.degToRad(rotation);
    this.dispatchEvent({ type: 'change' });
    this.rotateStackedItems(this.rotation.y - lastRotation);
  }

  stack(object) {
    // Guard: avoid stacking cycles and duplicate parenting
    if (object === this) return;
    if (object.stackedTo && object.stackedTo !== this) {
      object.stackedTo.unstack(object);
    }
    this.stackedItems.add(object);
    object.setColor(0xffff00); // Change color to yellow when stacked
    object.relativePosition = {
      x: object.position.x - this.position.x,
      y: object.position.y - this.position.y,
      z: object.position.z - this.position.z
    };
    object.stackedTo = this;

    // handle stacking recursively for all objects stacked on top of this object
    object.moveStackedItems();
  }

  unstack(object) {
    this.stackedItems.delete(object);
    object.stackedTo = null;
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
      // Recursively move items stacked on top of this item
      item.moveStackedItems();
      item.dispatchEvent({ type: 'change' });
    });
  }

  rotateStackedItems(amount) {
    const sinA = Math.sin(amount);
    const cosA = Math.cos(amount);
    this.stackedItems.forEach(item => {
      const rel = item.relativePosition || {
        x: item.position.x - this.position.x,
        y: item.position.y - this.position.y,
        z: item.position.z - this.position.z,
      };
      // Rotate around Y using the same handedness as prior implementation
      const rx = rel.x * cosA + rel.z * sinA;
      const rz = -rel.x * sinA + rel.z * cosA;
      item.position.set(
        this.position.x + rx,
        this.position.y + rel.y,
        this.position.z + rz
      );
      item.rotation.y += amount;
      item.relativePosition = { x: rx, y: rel.y, z: rz };

      item.dispatchEvent({ type: 'change' });
      if (item.stackedItems) {
        item.rotateStackedItems(amount);
      }
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
